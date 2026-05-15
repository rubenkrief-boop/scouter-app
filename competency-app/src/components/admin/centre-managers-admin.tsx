'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { addCentreManager, removeCentreManager, type CentreManagerRow } from '@/lib/actions/centre-managers'

interface LocationLite { id: string; name: string }
interface ManagerLite { id: string; first_name: string; last_name: string; email: string; role: string }

interface Props {
  rows: CentreManagerRow[]
  locations: LocationLite[]
  managers: ManagerLite[]
}

export function CentreManagersAdmin({ rows, locations, managers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [openAdd, setOpenAdd] = useState(false)
  const [selManager, setSelManager] = useState('')
  const [selLocation, setSelLocation] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      r.manager_name.toLowerCase().includes(q) ||
      r.manager_email.toLowerCase().includes(q) ||
      r.location_name.toLowerCase().includes(q),
    )
  }, [rows, search])

  // Stats : combien de centres par gerant + combien de gerants par centre
  const stats = useMemo(() => {
    const byManager = new Map<string, number>()
    const byLocation = new Map<string, number>()
    for (const r of rows) {
      byManager.set(r.manager_id, (byManager.get(r.manager_id) ?? 0) + 1)
      byLocation.set(r.location_id, (byLocation.get(r.location_id) ?? 0) + 1)
    }
    return {
      total: rows.length,
      multiCentres: Array.from(byManager.values()).filter((n) => n > 1).length,
      multiGerants: Array.from(byLocation.values()).filter((n) => n > 1).length,
    }
  }, [rows])

  function handleAdd() {
    if (!selManager || !selLocation) {
      toast.error('Sélectionnez un gérant et un centre')
      return
    }
    startTransition(async () => {
      const res = await addCentreManager({
        manager_id: selManager,
        location_id: selLocation,
        is_primary: isPrimary,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Erreur')
        return
      }
      toast.success('Affectation ajoutée')
      setOpenAdd(false)
      setSelManager('')
      setSelLocation('')
      setIsPrimary(false)
      router.refresh()
    })
  }

  function handleRemove(row: CentreManagerRow) {
    if (!confirm(`Retirer ${row.manager_name} de ${row.location_name} ?`)) return
    startTransition(async () => {
      const res = await removeCentreManager({
        manager_id: row.manager_id,
        location_id: row.location_id,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Erreur')
        return
      }
      toast.success('Affectation retirée')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-semibold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Affectations totales</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-semibold">{stats.multiCentres}</div>
          <div className="text-xs text-muted-foreground">Gérants multi-centres</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-semibold">{stats.multiGerants}</div>
          <div className="text-xs text-muted-foreground">Centres avec co-gérants</div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher gérant ou centre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setOpenAdd(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une affectation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centre</TableHead>
                <TableHead>Gérant</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Principal ?</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Aucune affectation
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={`${row.manager_id}-${row.location_id}`}>
                    <TableCell className="font-medium">{row.location_name}</TableCell>
                    <TableCell>{row.manager_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.manager_email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{row.manager_role}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.is_primary && <Badge className="text-[10px]">Principal</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(row)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une affectation gérant ↔ centre</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Gérant</Label>
              <Select value={selManager} onValueChange={setSelManager}>
                <SelectTrigger><SelectValue placeholder="Choisir un gérant" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} — {m.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centre</Label>
              <Select value={selLocation} onValueChange={setSelLocation}>
                <SelectTrigger><SelectValue placeholder="Choisir un centre" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-4 w-4"
              />
              Gérant principal de ce centre
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
