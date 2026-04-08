'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, X } from 'lucide-react'
import type { FormationSession, FormationAtelierWithSession } from '@/lib/types'
import {
  createFormationAtelier, deleteFormationAtelier,
} from '@/lib/actions/formations'
import type { ShowMessageFn } from '../hooks/use-admin-message'

// ============================================
// Ateliers Section
// ============================================

export function AteliersSection({
  ateliers,
  sessions,
  showMessage,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  showMessage: ShowMessageFn
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    session_id: '', nom: '', formateur: '', duree: '', type: 'Audio' as 'Audio' | 'Assistante',
    etat: 'Pas commencé' as 'Terminé' | 'En cours' | 'Pas commencé', programmes: '',
  })
  const [filterSession, setFilterSession] = useState<string>('all')
  const router = useRouter()

  const resetForm = () => {
    setForm({ session_id: '', nom: '', formateur: '', duree: '', type: 'Audio', etat: 'Pas commencé', programmes: '' })
    setShowAdd(false)
  }

  const filtered = filterSession === 'all' ? ateliers : ateliers.filter(a => a.session_id === filterSession)

  const handleAdd = async () => {
    if (!form.session_id || !form.nom) return showMessage('error', 'Session et nom requis')
    const result = await createFormationAtelier({
      session_id: form.session_id,
      nom: form.nom,
      formateur: form.formateur || undefined,
      duree: form.duree || undefined,
      type: form.type,
      etat: form.etat,
      programmes: form.programmes || undefined,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Atelier créé')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer l'atelier "${nom}" ?`)) return
    const result = await deleteFormationAtelier(id)
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Atelier supprimé')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sessions</SelectItem>
            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter atelier
        </Button>
      </div>

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Select value={form.session_id} onValueChange={v => setForm({ ...form, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Nom de l'atelier" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
              <Input placeholder="Formateur" value={form.formateur} onChange={e => setForm({ ...form, formateur: e.target.value })} />
              <Input placeholder="Durée" value={form.duree} onChange={e => setForm({ ...form, duree: e.target.value })} />
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as 'Audio' | 'Assistante' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Audio">Audio</SelectItem>
                  <SelectItem value="Assistante">Assistante</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.etat} onValueChange={v => setForm({ ...form, etat: v as 'Terminé' | 'En cours' | 'Pas commencé' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pas commencé">Pas commencé</SelectItem>
                  <SelectItem value="En cours">En cours</SelectItem>
                  <SelectItem value="Terminé">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Programmes (ex: P1 & P2)" value={form.programmes} onChange={e => setForm({ ...form, programmes: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}><Save className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{filtered.length}</span> atelier(s)
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Session</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Formateur</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">État</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3 font-medium">{a.nom}</td>
                <td className="p-3 text-muted-foreground text-xs">{a.session?.label || '-'}</td>
                <td className="p-3">
                  <Badge variant="outline" className={a.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                    {a.type}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{a.formateur || '-'}</td>
                <td className="p-3">
                  <Badge variant="outline" className={
                    a.etat === 'Terminé' ? 'text-green-500 border-green-500/30' :
                    a.etat === 'En cours' ? 'text-yellow-500 border-yellow-500/30' :
                    'text-muted-foreground'
                  }>
                    {a.etat}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id, a.nom)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Aucun atelier</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
