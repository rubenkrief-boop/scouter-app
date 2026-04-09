'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { Calendar, Plus, MapPin, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { createVisit, cancelVisit, updateVisit } from '@/lib/actions/visits'
import type { VisitWithRelations, GeographicZone, UserRole } from '@/lib/types'

// ============================================
// Status config
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planifiee', color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  completed: { label: 'Terminee', color: 'text-green-700', bg: 'bg-green-100 dark:bg-green-900/30' },
  cancelled: { label: 'Annulee', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
}

function VisitStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned
  return <Badge className={`${config.bg} ${config.color} border-0`}>{config.label}</Badge>
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateRange(start: string, end: string) {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} → ${formatDate(end)}`
}

// ============================================
// Props
// ============================================

interface VisitListViewProps {
  visits: VisitWithRelations[]
  zones: GeographicZone[]
  locations: { id: string; name: string }[]
  canPlan: boolean
  userRole: UserRole
}

// ============================================
// Component
// ============================================

export function VisitListView({ visits, zones: _zones, locations, canPlan, userRole: _userRole }: VisitListViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Filter visits
  const filtered = useMemo(() => {
    return visits.filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (locationFilter !== 'all' && v.location_id !== locationFilter) return false
      return true
    })
  }, [visits, statusFilter, locationFilter])

  // Header stats (memoized: avoid 3 filters + Set build per render on unrelated state changes)
  const headerStats = useMemo(() => {
    let planned = 0
    let completed = 0
    const activeLocationIds = new Set<string>()
    for (const v of visits) {
      if (v.status === 'planned') planned++
      else if (v.status === 'completed') completed++
      if (v.status !== 'cancelled') activeLocationIds.add(v.location_id)
    }
    return { planned, completed, centersCovered: activeLocationIds.size }
  }, [visits])

  // Group by month for timeline
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, VisitWithRelations[]> = {}
    for (const v of filtered) {
      const d = new Date(v.start_date + 'T00:00:00')
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      if (!groups[label]) groups[label] = []
      groups[label].push(v)
    }
    return Object.entries(groups)
  }, [filtered])

  function handleStatusChange(visitId: string, newStatus: 'completed' | 'cancelled') {
    startTransition(async () => {
      const result = newStatus === 'cancelled'
        ? await cancelVisit(visitId)
        : await updateVisit(visitId, { status: newStatus })
      if (result.success) {
        toast.success(newStatus === 'completed' ? 'Visite terminee' : 'Visite annulee')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Filters + Create button */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="planned">Planifiees</SelectItem>
            <SelectItem value="completed">Terminees</SelectItem>
            <SelectItem value="cancelled">Annulees</SelectItem>
          </SelectContent>
        </Select>

        {locations.length > 0 && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Centre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les centres</SelectItem>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex-1" />

        {canPlan && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Planifier une visite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateVisitForm
                locations={locations}
                onClose={() => { setShowCreateDialog(false); router.refresh() }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planifiees</p>
                <p className="text-xl font-bold">{headerStats.planned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terminees</p>
                <p className="text-xl font-bold">{headerStats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Centres couverts</p>
                <p className="text-xl font-bold">
                  {headerStats.centersCovered}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {groupedByMonth.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune visite</p>
            {canPlan && <p className="text-sm mt-1">Planifiez votre premiere visite</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map(([month, monthVisits]) => (
            <div key={month}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {month}
              </h3>
              <div className="space-y-2">
                {monthVisits.map(visit => {
                  const zone: GeographicZone | null = visit.location?.zone ?? null
                  const zoneColor = zone?.color || '#6B7280'
                  return (
                    <Card key={visit.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          {/* Zone color indicator */}
                          <div
                            className="w-1.5 h-12 rounded-full flex-shrink-0"
                            style={{ backgroundColor: zoneColor }}
                          />

                          {/* Date */}
                          <div className="min-w-[140px]">
                            <p className="text-sm font-semibold">
                              {formatDateRange(visit.start_date, visit.end_date)}
                            </p>
                            {visit.start_date !== visit.end_date && (
                              <p className="text-xs text-muted-foreground">
                                {Math.ceil((new Date(visit.end_date).getTime() - new Date(visit.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} jours
                              </p>
                            )}
                          </div>

                          {/* Location */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm truncate">
                                {visit.location?.name ?? '-'}
                              </span>
                              {visit.location?.city && (
                                <span className="text-xs text-muted-foreground">({visit.location.city})</span>
                              )}
                            </div>
                            {zone && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-[10px]"
                                style={{ borderColor: zoneColor, color: zoneColor }}
                              >
                                {zone.name}
                              </Badge>
                            )}
                          </div>

                          {/* Creator */}
                          <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-[120px]">
                            <User2 className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {visit.creator ? `${visit.creator.first_name} ${visit.creator.last_name}` : '-'}
                            </span>
                          </div>

                          {/* Status */}
                          <VisitStatusBadge status={visit.status} />

                          {/* Actions */}
                          {canPlan && visit.status === 'planned' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-green-600 hover:text-green-700"
                                disabled={isPending}
                                onClick={() => handleStatusChange(visit.id, 'completed')}
                              >
                                Terminer
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-red-500 hover:text-red-600"
                                disabled={isPending}
                                onClick={() => handleStatusChange(visit.id, 'cancelled')}
                              >
                                Annuler
                              </Button>
                            </div>
                          )}
                        </div>

                        {visit.notes && (
                          <p className="text-xs text-muted-foreground mt-2 ml-6 italic">{visit.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Create Visit Form
// ============================================

function CreateVisitForm({
  locations,
  onClose,
}: {
  locations: { id: string; name: string }[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [locationId, setLocationId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!locationId || !startDate) {
      toast.error('Centre et date de debut sont requis')
      return
    }

    startTransition(async () => {
      const result = await createVisit({
        location_id: locationId,
        start_date: startDate,
        end_date: endDate || startDate,
        notes: notes || undefined,
      })

      if (result.success) {
        toast.success('Visite planifiee')
        onClose()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Planifier une visite
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Centre *</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un centre..." />
            </SelectTrigger>
            <SelectContent>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date debut *</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Date fin</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
            />
            <p className="text-xs text-muted-foreground">Meme jour si vide</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <textarea
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Objectif de la visite..."
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Planification...' : 'Planifier'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
