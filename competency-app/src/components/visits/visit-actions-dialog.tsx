'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Calendar, MapPin, User2, Pencil, X, Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { updateVisit, cancelVisit, deleteVisit, reopenVisit } from '@/lib/actions/visits'
import type { VisitWithRelations } from '@/lib/types'

// ============================================
// Single dialog for all visit actions: Modifier / Annuler / Supprimer / (Réouvrir)
// ============================================

type Mode = 'menu' | 'edit' | 'confirm-cancel' | 'confirm-delete' | 'confirm-reopen'

export function VisitActionsDialog({
  visit,
  open,
  onOpenChange,
}: {
  visit: VisitWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>('menu')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  // Reset mode + form when a new visit is opened
  function handleOpenChange(o: boolean) {
    if (!o) {
      setMode('menu')
    } else if (visit) {
      setStartDate(visit.start_date)
      setEndDate(visit.end_date)
      setNotes(visit.notes ?? '')
      setMode('menu')
    }
    onOpenChange(o)
  }

  if (!visit) return null

  const creator = visit.creator as { first_name?: string; last_name?: string } | undefined
  const creatorName = creator ? `${creator.first_name ?? ''} ${creator.last_name ?? ''}`.trim() : '—'
  const isCompleted = visit.status === 'completed'
  const isCancelled = visit.status === 'cancelled'
  const isPlanned = visit.status === 'planned'

  function refresh() {
    onOpenChange(false)
    router.refresh()
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate) { toast.error('Date de debut requise'); return }
    if (endDate && endDate < startDate) { toast.error('Date de fin invalide'); return }
    startTransition(async () => {
      const result = await updateVisit(visit!.id, {
        start_date: startDate,
        end_date: endDate || startDate,
        notes,
      })
      if (result.success) { toast.success('Visite mise a jour'); refresh() }
      else { toast.error(result.error ?? 'Erreur') }
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelVisit(visit!.id)
      if (result.success) { toast.success('Visite annulee'); refresh() }
      else { toast.error(result.error ?? 'Erreur') }
    })
  }

  function handleReopen() {
    startTransition(async () => {
      const result = await reopenVisit(visit!.id)
      if (result.success) { toast.success('Visite remise en planifiee'); refresh() }
      else { toast.error(result.error ?? 'Erreur') }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVisit(visit!.id)
      if (result.success) { toast.success('Visite supprimee'); refresh() }
      else { toast.error(result.error ?? 'Erreur') }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {mode === 'edit' ? 'Modifier la visite' : 'Visite'}
          </DialogTitle>
        </DialogHeader>

        {/* Visit summary header (always visible) */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {visit.location?.name ?? '—'}
            {visit.location?.city && <span className="text-muted-foreground font-normal">- {visit.location.city}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User2 className="h-3 w-3" />
            {creatorName}
            <span>•</span>
            <span className={isCompleted ? 'text-green-600 font-medium' : isCancelled ? 'text-gray-500' : 'text-blue-600 font-medium'}>
              {isCompleted ? 'Terminee' : isCancelled ? 'Annulee' : 'Planifiee'}
            </span>
          </div>
        </div>

        {/* MENU mode: action buttons */}
        {mode === 'menu' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setMode('edit')} disabled={isPending}>
              <Pencil className="h-4 w-4 mr-2" /> Modifier
            </Button>
            {isPlanned && (
              <Button variant="outline" onClick={() => setMode('confirm-cancel')} disabled={isPending}>
                <X className="h-4 w-4 mr-2" /> Annuler
              </Button>
            )}
            {isCompleted && (
              <Button variant="outline" onClick={() => setMode('confirm-reopen')} disabled={isPending}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reouvrir
              </Button>
            )}
            {isCancelled && (
              <Button variant="outline" onClick={() => setMode('confirm-reopen')} disabled={isPending}>
                <RotateCcw className="h-4 w-4 mr-2" /> Reactiver
              </Button>
            )}
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 col-span-2"
              onClick={() => setMode('confirm-delete')}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer definitivement
            </Button>
          </div>
        )}

        {/* EDIT mode */}
        {mode === 'edit' && (
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date debut *</Label>
                <Input type="date" value={startDate} onChange={e => {
                  setStartDate(e.target.value)
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
                }} required />
              </div>
              <div className="space-y-1">
                <Label>Date fin</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Notes..."
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setMode('menu')} disabled={isPending}>Retour</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* CANCEL confirmation */}
        {mode === 'confirm-cancel' && (
          <ConfirmBlock
            title="Annuler cette visite ?"
            description="La visite sera marquee comme annulee. Tu pourras la reactiver plus tard si besoin."
            onBack={() => setMode('menu')}
            onConfirm={handleCancel}
            confirmLabel="Annuler la visite"
            isPending={isPending}
          />
        )}

        {/* REOPEN confirmation */}
        {mode === 'confirm-reopen' && (
          <ConfirmBlock
            title={isCompleted ? 'Reouvrir cette visite ?' : 'Reactiver cette visite ?'}
            description={isCompleted
              ? 'La visite sera remise en \"planifiee\" — utile si l\'auto-completion s\'est trompee.'
              : 'La visite sera remise en \"planifiee\" et comptera de nouveau dans l\'objectif.'}
            onBack={() => setMode('menu')}
            onConfirm={handleReopen}
            confirmLabel={isCompleted ? 'Reouvrir' : 'Reactiver'}
            isPending={isPending}
          />
        )}

        {/* DELETE confirmation */}
        {mode === 'confirm-delete' && (
          <ConfirmBlock
            title="Supprimer definitivement ?"
            description="La visite sera effacee de la base de donnees. Cette action est irreversible."
            onBack={() => setMode('menu')}
            onConfirm={handleDelete}
            confirmLabel="Supprimer"
            destructive
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ConfirmBlock({
  title, description, onBack, onConfirm, confirmLabel, destructive, isPending,
}: {
  title: string
  description: string
  onBack: () => void
  onConfirm: () => void
  confirmLabel: string
  destructive?: boolean
  isPending: boolean
}) {
  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-3 flex gap-2.5 ${destructive ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'}`}>
        <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${destructive ? 'text-red-600' : 'text-orange-600'}`} />
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>Retour</Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  )
}
