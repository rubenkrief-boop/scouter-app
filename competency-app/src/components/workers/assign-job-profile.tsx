'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Loader2 } from 'lucide-react'
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
}

export function AssignJobProfile({ workerId, jobProfiles }: AssignJobProfileProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleAssign() {
    if (!selectedId) return
    setLoading(true)

    try {
      const selectedProfile = jobProfiles.find(jp => jp.id === selectedId)
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: workerId,
          job_profile_id: selectedId,
          job_title: selectedProfile?.name || null,
        }),
      })

      if (res.ok) {
        toast.success(`Profil métier « ${selectedProfile?.name} » attribué`)
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

  return (
    <div className="flex flex-col items-center gap-3">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Choisir un profil métier..." />
        </SelectTrigger>
        <SelectContent>
          {jobProfiles.map((jp) => (
            <SelectItem key={jp.id} value={jp.id}>
              {jp.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={handleAssign}
        disabled={!selectedId || loading}
        className="bg-indigo-600 hover:bg-indigo-700"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Briefcase className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Attribution...' : 'Attribuer ce profil métier'}
      </Button>
    </div>
  )
}
