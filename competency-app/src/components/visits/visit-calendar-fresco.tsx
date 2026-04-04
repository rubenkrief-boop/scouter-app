'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import type { VisitWithRelations, GeographicZone } from '@/lib/types'

// ============================================
// Annual calendar fresco — visual timeline
// ============================================

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

interface CalendarFrescoProps {
  visits: VisitWithRelations[]
  year?: number
}

export function VisitCalendarFresco({ visits, year: propYear }: CalendarFrescoProps) {
  const year = propYear ?? new Date().getFullYear()
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const daysInMonth = [...MONTH_DAYS]
  if (isLeap) daysInMonth[1] = 29
  const totalDays = daysInMonth.reduce((a, b) => a + b, 0)

  // Filter visits for this year
  const yearVisits = useMemo(() => {
    return visits.filter(v => {
      const start = new Date(v.start_date + 'T00:00:00')
      const end = new Date(v.end_date + 'T00:00:00')
      return start.getFullYear() === year || end.getFullYear() === year
    })
  }, [visits, year])

  // Get unique locations with visits
  const locationRows = useMemo(() => {
    const map = new Map<string, {
      id: string
      name: string
      city: string | null
      zone: GeographicZone | null
      visits: VisitWithRelations[]
    }>()

    for (const v of yearVisits) {
      if (!v.location) continue
      if (!map.has(v.location_id)) {
        const zone = (v.location as unknown as { zone?: GeographicZone | null })?.zone ?? null
        map.set(v.location_id, {
          id: v.location_id,
          name: v.location.name,
          city: v.location.city ?? null,
          zone,
          visits: [],
        })
      }
      map.get(v.location_id)!.visits.push(v)
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [yearVisits])

  // Convert date to day-of-year (0-based)
  function dateToDayOfYear(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00')
    if (d.getFullYear() !== year) {
      return d.getFullYear() < year ? 0 : totalDays - 1
    }
    let dayOfYear = d.getDate() - 1
    for (let m = 0; m < d.getMonth(); m++) {
      dayOfYear += daysInMonth[m]
    }
    return Math.max(0, Math.min(totalDays - 1, dayOfYear))
  }

  // Today marker
  const today = new Date()
  const todayDoy = today.getFullYear() === year
    ? dateToDayOfYear(today.toISOString().split('T')[0])
    : -1

  if (locationRows.length === 0) {
    return null // Don't show if no visits
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Fresque {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Month headers */}
          <div className="flex mb-1">
            <div className="w-[160px] flex-shrink-0" />
            <div className="flex-1 flex">
              {MONTH_LABELS.map((label, i) => {
                const widthPct = (daysInMonth[i] / totalDays) * 100
                return (
                  <div
                    key={label}
                    className="text-center text-[10px] font-medium text-muted-foreground border-l border-border first:border-l-0"
                    style={{ width: `${widthPct}%` }}
                  >
                    {label}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Location rows */}
          {locationRows.map(loc => {
            const zoneColor = loc.zone?.color || '#6B7280'
            return (
              <div key={loc.id} className="flex items-center mb-0.5 group">
                {/* Location label */}
                <div className="w-[160px] flex-shrink-0 pr-2 flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: zoneColor }}
                  />
                  <span className="text-xs font-medium truncate">{loc.name}</span>
                  {loc.zone && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 flex-shrink-0" style={{ borderColor: zoneColor, color: zoneColor }}>
                      {loc.zone.name}
                    </Badge>
                  )}
                </div>

                {/* Timeline bar */}
                <div className="flex-1 relative h-6 bg-muted/30 rounded-sm border border-border/50">
                  {/* Month dividers */}
                  {daysInMonth.map((_, i) => {
                    if (i === 0) return null
                    let offset = 0
                    for (let j = 0; j < i; j++) offset += daysInMonth[j]
                    const leftPct = (offset / totalDays) * 100
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-border/30"
                        style={{ left: `${leftPct}%` }}
                      />
                    )
                  })}

                  {/* Today marker */}
                  {todayDoy >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                      style={{ left: `${(todayDoy / totalDays) * 100}%` }}
                    />
                  )}

                  {/* Visit bars */}
                  {loc.visits.map(v => {
                    const startDay = dateToDayOfYear(v.start_date)
                    const endDay = dateToDayOfYear(v.end_date)
                    const leftPct = (startDay / totalDays) * 100
                    const widthPct = Math.max(0.3, ((endDay - startDay + 1) / totalDays) * 100)
                    const isCompleted = v.status === 'completed'
                    const isCancelled = v.status === 'cancelled'
                    const bgColor = isCancelled ? '#D1D5DB' : isCompleted ? '#10B981' : zoneColor

                    return (
                      <div
                        key={v.id}
                        className="absolute top-1 bottom-1 rounded-sm cursor-pointer transition-opacity hover:opacity-80"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: bgColor,
                          opacity: isCancelled ? 0.4 : 0.85,
                        }}
                        title={`${v.location?.name} — ${new Date(v.start_date + 'T00:00:00').toLocaleDateString('fr-FR')}${v.start_date !== v.end_date ? ' → ' + new Date(v.end_date + 'T00:00:00').toLocaleDateString('fr-FR') : ''} — ${v.status === 'completed' ? 'Terminée' : v.status === 'cancelled' ? 'Annulée' : 'Planifiée'}`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-500 opacity-85" />
              <span className="text-[10px] text-muted-foreground">Planifiee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground">Terminee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-gray-300 opacity-40" />
              <span className="text-[10px] text-muted-foreground">Annulee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-red-400" />
              <span className="text-[10px] text-muted-foreground">Aujourd&apos;hui</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
