'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import type { FormationSession } from '@/lib/types'
import {
  createFormationSession, updateFormationSession, deleteFormationSession,
} from '@/lib/actions/formations'
import type { ShowMessageFn } from '../hooks/use-admin-message'

// ============================================
// Sessions Section
// ============================================

export function SessionsSection({
  sessions,
  showMessage,
}: {
  sessions: FormationSession[]
  showMessage: ShowMessageFn
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', label: '', date_info: '', sort_order: '0' })
  const router = useRouter()

  const resetForm = () => {
    setForm({ code: '', label: '', date_info: '', sort_order: '0' })
    setShowAdd(false)
    setEditId(null)
  }

  const handleAdd = async () => {
    if (!form.code || !form.label) return showMessage('error', 'Code et label requis')
    const result = await createFormationSession({
      code: form.code,
      label: form.label,
      date_info: form.date_info || undefined,
      sort_order: parseInt(form.sort_order) || 0,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session créée')
    resetForm()
    router.refresh()
  }

  const handleEdit = async (id: string) => {
    const result = await updateFormationSession(id, {
      label: form.label,
      date_info: form.date_info || undefined,
      sort_order: parseInt(form.sort_order) || 0,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session mise à jour')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Supprimer la session "${label}" et toutes ses données ?`)) return
    const result = await deleteFormationSession(id)
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session supprimée')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter session
        </Button>
      </div>

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Code (ex: s26)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              <Input placeholder="Label (ex: SEPT 2026)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              <Input placeholder="Date info" value={form.date_info} onChange={e => setForm({ ...form, date_info: e.target.value })} />
              <Input placeholder="Ordre" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleAdd}><Save className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Code</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Label</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Date</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Ordre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Actif</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                {editId === s.id ? (
                  <>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3"><Input className="h-8 text-sm" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></td>
                    <td className="p-3"><Input className="h-8 text-sm" value={form.date_info} onChange={e => setForm({ ...form, date_info: e.target.value })} /></td>
                    <td className="p-3"><Input className="h-8 text-sm w-20" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></td>
                    <td className="p-3"><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Oui' : 'Non'}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(s.id)}><Save className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetForm}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3 font-medium">{s.label}</td>
                    <td className="p-3 text-muted-foreground">{s.date_info || '-'}</td>
                    <td className="p-3">{s.sort_order}</td>
                    <td className="p-3"><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Oui' : 'Non'}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                          setForm({ code: s.code, label: s.label, date_info: s.date_info || '', sort_order: String(s.sort_order) })
                          setEditId(s.id)
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id, s.label)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Aucune session</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
