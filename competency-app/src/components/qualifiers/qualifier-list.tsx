'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { QualifierWithOptions } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface QualifierListProps {
  qualifiers: QualifierWithOptions[]
}

export function QualifierList({ qualifiers }: QualifierListProps) {
  const router = useRouter()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingQualifier, setEditingQualifier] = useState<QualifierWithOptions | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const supabase = createClient()

    const { error } = await supabase.from('qualifiers').insert({
      name: formData.get('name') as string,
      qualifier_type: (formData.get('qualifier_type') as string) || 'single_choice',
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      is_active: true,
    })

    if (!error) {
      setIsCreateOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce qualifier ?')) return
    const supabase = createClient()
    await supabase.from('qualifiers').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-2" />
              Créer un qualifier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau qualifier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input id="name" name="name" required placeholder="Ex: Maîtrise" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualifier_type">Type</Label>
                <Select name="qualifier_type" defaultValue="single_choice">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_choice">Choix unique</SelectItem>
                    <SelectItem value="multiple_choice">Choix multiple</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordre</Label>
                <Input id="sort_order" name="sort_order" type="number" defaultValue="0" />
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
                {loading ? 'Création...' : 'Créer'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {qualifiers.map((qualifier) => (
          <Card key={qualifier.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  <Badge variant="outline" className="text-xs">
                    {qualifier.sort_order}
                  </Badge>
                  <div>
                    <h3 className="font-semibold">{qualifier.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {qualifier.qualifier_type === 'single_choice' ? 'Choix unique' : 'Choix multiple'}
                      {' - '}
                      {qualifier.qualifier_options?.length ?? 0} option(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 mr-4">
                    {qualifier.qualifier_options
                      ?.sort((a, b) => a.sort_order - b.sort_order)
                      .map((option) => (
                        <Badge key={option.id} variant="secondary" className="text-xs">
                          {option.label}
                        </Badge>
                      ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/skill-master/qualifiers/${qualifier.id}`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(qualifier.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {qualifiers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Aucun qualifier. Créez votre premier qualifier pour commencer.
          </div>
        )}
      </div>
    </div>
  )
}
