'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface JobProfileOption {
  id: string
  name: string
}

interface AssignJobProfileProps {
  workerId: string
  jobProfiles: JobProfileOption[]
  assignedProfileIds: string[]
}

export function AssignJobProfile({ workerId, jobProfiles, assignedProfileIds }: AssignJobProfileProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Filtrer les profils déjà assignés
  const availableProfiles = jobProfiles.filter(jp => !assignedProfileIds.includes(jp.id))

  async function handleAssign() {
    if (!selectedId) return
    setLoading(true)

    try {
      const res = await fetch(`/api/workers/${workerId}/job-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobProfileId: selectedId }),
      })

      if (res.ok) {
        const selectedProfile = jobProfiles.find(jp => jp.id === selectedId)
        toast.success(`Profil « ${selectedProfile?.name} » attribué`)
        setSelectedId('')
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Erreur lors de l\'attribution')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setLoading(false)
  }

  if (availableProfiles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Tous les profils métier sont déjà attribués.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Choisir un profil métier..." />
        </SelectTrigger>
        <SelectContent>
          {availableProfiles.map((jp) => (
            <SelectItem key={jp.id} value={jp.id}>
              {jp.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={handleAssign}
        disabled={!selectedId || loading}
        size="sm"
        className="bg-indigo-600 hover:bg-indigo-700"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Ajouter
      </Button>
    </div>
  )
}
