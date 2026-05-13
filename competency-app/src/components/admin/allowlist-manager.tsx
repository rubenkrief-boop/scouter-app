'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  addToAllowlist,
  setAllowlistActive,
  type AllowlistRow,
} from '@/lib/actions/email-allowlist'

interface Props {
  rows: AllowlistRow[]
  currentUserEmail: string
}

export function AllowlistManager({ rows, currentUserEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  function resetForm() {
    setEmail('')
    setNotes('')
    setShowForm(false)
  }

  function handleAdd() {
    if (!email.trim()) {
      toast.error('Email requis')
      return
    }
    startTransition(async () => {
      const result = await addToAllowlist({
        email: email.trim(),
        notes: notes.trim() || null,
      })
      if (result.success) {
        toast.success('Email ajoute a la liste')
        resetForm()
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  function handleToggle(rowEmail: string, currentActive: boolean) {
    startTransition(async () => {
      const result = await setAllowlistActive(rowEmail, !currentActive)
      if (result.success) {
        toast.success(currentActive ? 'Email desactive' : 'Email reactive')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {showForm ? (
          <Button variant="outline" onClick={resetForm} disabled={isPending}>
            Annuler
          </Button>
        ) : (
          <Button onClick={() => setShowForm(true)} disabled={isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un email
          </Button>
        )}
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="prenom.nom@vivason.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="new-notes">Notes (optionnel)</Label>
            <Input
              id="new-notes"
              type="text"
              placeholder="Ex : nouveau audio Bastille, arrivee 01/06"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={handleAdd} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden md:table-cell">Notes</TableHead>
              <TableHead className="hidden md:table-cell">Ajoute le</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucun email enregistre.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isSelf = row.email === currentUserEmail.toLowerCase()
                return (
                  <TableRow key={row.email}>
                    <TableCell className="font-mono text-sm">
                      {row.email}
                      {isSelf && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Vous
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.is_active ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs truncate">
                      {row.notes ?? '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {new Date(row.added_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={row.is_active ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleToggle(row.email, row.is_active)}
                        disabled={isPending || isSelf}
                      >
                        {row.is_active ? 'Desactiver' : 'Reactiver'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
