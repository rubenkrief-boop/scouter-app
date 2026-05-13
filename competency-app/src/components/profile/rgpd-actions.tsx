'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  userEmail: string
}

export function RgpdActions({ userEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')

  function handleExport() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/me/export', { method: 'GET' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error || `Echec export (${res.status})`)
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scouter-export-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success('Export telecharge')
      } catch (e) {
        toast.error('Erreur reseau pendant l\'export')
      }
    })
  }

  function handleDelete() {
    if (confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      toast.error('La confirmation doit correspondre exactement a votre email')
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/me/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: confirmEmail.trim() }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          toast.error(body.error || `Echec suppression (${res.status})`)
          return
        }
        toast.success('Compte anonymise. Vous allez etre deconnecte.')
        setDeleteOpen(false)
        // La route a deja signOut() cote serveur — on force juste un reload.
        setTimeout(() => router.push('/auth/login'), 1500)
      } catch (e) {
        toast.error('Erreur reseau pendant la suppression')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Vos donnees personnelles (RGPD)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Article 20 (portabilite) et Article 17 (effacement) du Reglement General sur la Protection des Donnees.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
          <Download className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Exporter mes donnees</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Telecharge un fichier JSON avec votre profil, vos evaluations,
              vos inscriptions formations et les commentaires vous concernant.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Exporter
          </Button>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-md border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800">
          <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-rose-900 dark:text-rose-200">Supprimer mon compte</p>
            <p className="text-rose-700 dark:text-rose-300 text-xs mt-0.5">
              Action irreversible. Votre profil sera anonymise (nom, prenom,
              email remplaces). Vos evaluations restent en base (obligation
              legale de conservation RH) mais sont rattachees a un profil
              anonyme. Vous ne pourrez plus vous reconnecter.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={isPending}
          >
            <Trash2 className="h-3 w-3 mr-2" />
            Supprimer
          </Button>
        </div>
      </CardContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression definitive</DialogTitle>
            <DialogDescription>
              Pour confirmer, tapez votre email <strong>{userEmail}</strong> ci-dessous.
              Cette action est <strong>irreversible</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-email">Email de confirmation</Label>
            <Input
              id="confirm-email"
              type="email"
              placeholder={userEmail}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteOpen(false); setConfirmEmail('') }}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending || !confirmEmail.trim()}
            >
              {isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Supprimer definitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
