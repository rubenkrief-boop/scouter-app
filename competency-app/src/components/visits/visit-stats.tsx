'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { MapPin, User2, Calendar, TrendingUp } from 'lucide-react'
import type { VisitWithRelations, GeographicZone } from '@/lib/types'

interface VisitStatsProps {
  visits: VisitWithRelations[]
}

export function VisitStats({ visits }: VisitStatsProps) {
  // Only non-cancelled visits
  const activeVisits = useMemo(() => visits.filter(v => v.status !== 'cancelled'), [visits])

  // By centre
  const byCentre = useMemo(() => {
    const map = new Map<string, { name: string; zone: string | null; zoneColor: string | null; planned: number; completed: number; total: number }>()
    for (const v of activeVisits) {
      const key = v.location_id
      const zone = (v.location as unknown as { zone?: GeographicZone | null })?.zone ?? null
      if (!map.has(key)) {
        map.set(key, {
          name: v.location?.name ?? '-',
          zone: zone?.name ?? null,
          zoneColor: zone?.color ?? null,
          planned: 0, completed: 0, total: 0,
        })
      }
      const entry = map.get(key)!
      entry.total++
      if (v.status === 'planned') entry.planned++
      if (v.status === 'completed') entry.completed++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [activeVisits])

  // By zone
  const byZone = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; planned: number; completed: number; total: number; centres: Set<string> }>()
    for (const v of activeVisits) {
      const zone = (v.location as unknown as { zone?: GeographicZone | null })?.zone
      const key = zone?.name ?? 'Non attribue'
      if (!map.has(key)) {
        map.set(key, { name: key, color: zone?.color ?? null, planned: 0, completed: 0, total: 0, centres: new Set() })
      }
      const entry = map.get(key)!
      entry.total++
      entry.centres.add(v.location_id)
      if (v.status === 'planned') entry.planned++
      if (v.status === 'completed') entry.completed++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [activeVisits])

  // By user (planificateur)
  const byUser = useMemo(() => {
    const map = new Map<string, { name: string; role: string; planned: number; completed: number; total: number; centres: Set<string> }>()
    for (const v of activeVisits) {
      const key = v.created_by
      if (!map.has(key)) {
        map.set(key, {
          name: v.creator ? `${v.creator.first_name} ${v.creator.last_name}` : '-',
          role: v.creator?.role ?? '-',
          planned: 0, completed: 0, total: 0, centres: new Set(),
        })
      }
      const entry = map.get(key)!
      entry.total++
      entry.centres.add(v.location_id)
      if (v.status === 'planned') entry.planned++
      if (v.status === 'completed') entry.completed++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [activeVisits])

  if (activeVisits.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune visite enregistree</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total visites</p>
                <p className="text-xl font-bold">{activeVisits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terminees</p>
                <p className="text-xl font-bold">{activeVisits.filter(v => v.status === 'completed').length}</p>
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
                <p className="text-xl font-bold">{new Set(activeVisits.map(v => v.location_id)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <User2 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planificateurs</p>
                <p className="text-xl font-bold">{new Set(activeVisits.map(v => v.created_by)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par zone geographique</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Centres</TableHead>
                <TableHead>Planifiees</TableHead>
                <TableHead>Terminees</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byZone.map(z => (
                <TableRow key={z.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {z.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color }} />}
                      <span className="font-medium">{z.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{z.centres.size}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{z.planned}</Badge></TableCell>
                  <TableCell><Badge className="bg-green-100 text-green-700 border-0 text-xs">{z.completed}</Badge></TableCell>
                  <TableCell className="font-bold">{z.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By Centre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par centre</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centre</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Planifiees</TableHead>
                <TableHead>Terminees</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCentre.map(c => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.zone ? (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: c.zoneColor || undefined, color: c.zoneColor || undefined }}>
                        {c.zone}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{c.planned}</Badge></TableCell>
                  <TableCell><Badge className="bg-green-100 text-green-700 border-0 text-xs">{c.completed}</Badge></TableCell>
                  <TableCell className="font-bold">{c.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par planificateur</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Planificateur</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Centres</TableHead>
                <TableHead>Planifiees</TableHead>
                <TableHead>Terminees</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byUser.map(u => (
                <TableRow key={u.name}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.role}</TableCell>
                  <TableCell>{u.centres.size}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{u.planned}</Badge></TableCell>
                  <TableCell><Badge className="bg-green-100 text-green-700 border-0 text-xs">{u.completed}</Badge></TableCell>
                  <TableCell className="font-bold">{u.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
