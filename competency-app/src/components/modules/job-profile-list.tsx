'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import type { JobProfile } from '@/lib/types'

interface JobProfileListProps {
  profiles: JobProfile[]
}

export function JobProfileList({ profiles }: JobProfileListProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('job_profiles').insert({
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      is_active: true,
    })

    if (!error) {
      setIsOpen(false)
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce profil métier ?')) return
    const supabase = createClient()
    await supabase.from('job_profiles').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-2" />
              Créer un profil
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau profil métier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input name="name" required placeholder="Ex: Audioprothésiste confirmé" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" placeholder="Description optionnelle" />
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                Créer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{profile.name}</h3>
                {profile.description && (
                  <p className="text-sm text-muted-foreground">{profile.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/skill-master/job-profiles/${profile.id}`)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(profile.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {profiles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun profil métier. Créez votre premier profil pour définir les compétences attendues.
          </div>
        )}
      </div>
    </div>
  )
}
