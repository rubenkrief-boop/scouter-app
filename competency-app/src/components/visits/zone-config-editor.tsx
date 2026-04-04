'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { createGeographicZone, updateGeographicZone, deleteGeographicZone } from '@/lib/actions/geographic-zones'
import type { GeographicZone } from '@/lib/types'

function freqLabel(days: number): string {
  if (days <= 30) return 'Tous les mois'
  if (days <= 60) return 'Tous les 2 mois'
  if (days <= 90) return 'Tous les 3 mois'
  if (days <= 180) return 'Tous les 6 mois'
  if (days <= 365) return '1x/an'
  return `Tous les ${days} jours`
}

interface ZoneConfigEditorProps {
  zones: GeographicZone[]
}

export function ZoneConfigEditor({ zones }: ZoneConfigEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showDialog, setShowDialog] = useState(false)
  const [editingZone, setEditingZone] = useState<GeographicZone | null>(null)

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteGeographicZone(id)
      if (result.success) {
        toast.success('Zone supprimee')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Zones geographiques
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingZone(null) }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingZone(null)}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <ZoneForm
                zone={editingZone}
                onClose={() => { setShowDialog(false); setEditingZone(null); router.refresh() }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune zone configuree. Ajoutez IDF, Province, Maroc...
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Objectif Manager</TableHead>
                <TableHead>Objectif Resp.</TableHead>
                <TableHead>Freq. max Manager</TableHead>
                <TableHead>Freq. max Resp.</TableHead>
                <TableHead>Couleur</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map(zone => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">{zone.target_visits_manager}/an</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">{zone.target_visits_resp}/an</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{freqLabel(zone.freq_days_manager)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{freqLabel(zone.freq_days_resp)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: zone.color || '#3B82F6' }} />
                      <span className="text-xs text-muted-foreground">{zone.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setEditingZone(zone); setShowDialog(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        disabled={isPending}
                        onClick={() => handleDelete(zone.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Zone Form
// ============================================

function ZoneForm({ zone, onClose }: { zone: GeographicZone | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(zone?.name ?? '')
  const [targetManager, setTargetManager] = useState(zone?.target_visits_manager ?? 12)
  const [targetResp, setTargetResp] = useState(zone?.target_visits_resp ?? 6)
  const [freqManager, setFreqManager] = useState(zone?.freq_days_manager ?? 30)
  const [freqResp, setFreqResp] = useState(zone?.freq_days_resp ?? 60)
  const [color, setColor] = useState(zone?.color ?? '#3B82F6')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const data = {
        name,
        target_visits_manager: targetManager,
        target_visits_resp: targetResp,
        freq_days_manager: freqManager,
        freq_days_resp: freqResp,
        color,
      }
      const result = zone
        ? await updateGeographicZone(zone.id, data)
        : await createGeographicZone(data)

      if (result.success) {
        toast.success(zone ? 'Zone mise a jour' : 'Zone creee')
        onClose()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{zone ? 'Modifier la zone' : 'Nouvelle zone'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nom *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="IDF, Province, Maroc..." required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Objectif annuel Manager</Label>
            <Input type="number" min={1} value={targetManager} onChange={e => setTargetManager(parseInt(e.target.value) || 12)} />
            <p className="text-xs text-muted-foreground">{targetManager} visite{targetManager > 1 ? 's' : ''}/an</p>
          </div>
          <div className="space-y-2">
            <Label>Objectif annuel Resp. Audio</Label>
            <Input type="number" min={1} value={targetResp} onChange={e => setTargetResp(parseInt(e.target.value) || 6)} />
            <p className="text-xs text-muted-foreground">{targetResp} visite{targetResp > 1 ? 's' : ''}/an</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Frequence max Manager (jours)</Label>
            <Input type="number" min={1} value={freqManager} onChange={e => setFreqManager(parseInt(e.target.value) || 30)} />
            <p className="text-xs text-muted-foreground">Alerte si depasse {freqLabel(freqManager).toLowerCase()}</p>
          </div>
          <div className="space-y-2">
            <Label>Frequence max Resp. Audio (jours)</Label>
            <Input type="number" min={1} value={freqResp} onChange={e => setFreqResp(parseInt(e.target.value) || 60)} />
            <p className="text-xs text-muted-foreground">Alerte si depasse {freqLabel(freqResp).toLowerCase()}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Couleur</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
            <Input value={color} onChange={e => setColor(e.target.value)} className="w-28" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>{zone ? 'Enregistrer' : 'Creer'}</Button>
        </DialogFooter>
      </form>
    </>
  )
}
