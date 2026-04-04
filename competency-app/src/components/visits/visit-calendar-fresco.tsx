'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import type { VisitWithRelations, GeographicZone } from '@/lib/types'

// ============================================
// Annual calendar fresco — visual timeline
// ============================================

// Generate a consistent color from a string (name hash → HSL)
const PLANNER_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981',
  '#06B6D4', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444',
  '#84CC16', '#A855F7',
]

function plannerColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return PLANNER_COLORS[Math.abs(hash) % PLANNER_COLORS.length]
}

function initials(firstName?: string, lastName?: string): string {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

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
            <div className="w-[200px] flex-shrink-0" />
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
                {/* Location label + objective counter */}
                <div className="w-[200px] flex-shrink-0 pr-2 flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: zoneColor }}
                  />
                  <span className="text-xs font-medium truncate">{loc.name}</span>
                  {loc.zone && (() => {
                    const target = loc.zone.target_visits_manager ?? Math.ceil(365 / loc.zone.freq_days_manager)
                    const completedCount = loc.visits.filter(v => v.status === 'completed').length
                    const plannedCount = loc.visits.filter(v => v.status === 'planned').length
                    const totalActive = completedCount + plannedCount
                    const isOnTrack = totalActive >= target
                    return (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 h-4 flex-shrink-0 font-mono ${
                          isOnTrack ? 'border-green-400 text-green-600' : 'border-orange-400 text-orange-600'
                        }`}
                      >
                        {totalActive}/{target}
                      </Badge>
                    )
                  })()}
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

                  {/* Visit bars with planner initials + color */}
                  {loc.visits.map(v => {
                    const startDay = dateToDayOfYear(v.start_date)
                    const endDay = dateToDayOfYear(v.end_date)
                    const leftPct = (startDay / totalDays) * 100
                    const widthPct = Math.max(1.5, ((endDay - startDay + 1) / totalDays) * 100)
                    const isCompleted = v.status === 'completed'
                    const isCancelled = v.status === 'cancelled'
                    const creator = v.creator as { id: string; first_name: string; last_name: string } | undefined
                    const pColor = creator ? plannerColor(creator.id) : '#6B7280'
                    const pInitials = creator ? initials(creator.first_name, creator.last_name) : '?'
                    const bgColor = isCancelled ? '#D1D5DB' : pColor
                    const borderColor = isCompleted ? '#10B981' : 'transparent'

                    return (
                      <div
                        key={v.id}
                        className="absolute top-0.5 bottom-0.5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center overflow-hidden"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: bgColor,
                          opacity: isCancelled ? 0.3 : 0.9,
                          border: `2px solid ${borderColor}`,
                        }}
                        title={`${pInitials} — ${v.location?.name} — ${new Date(v.start_date + 'T00:00:00').toLocaleDateString('fr-FR')}${v.start_date !== v.end_date ? ' → ' + new Date(v.end_date + 'T00:00:00').toLocaleDateString('fr-FR') : ''} — ${v.status === 'completed' ? 'Terminée' : v.status === 'cancelled' ? 'Annulée' : 'Planifiée'}${creator ? ' — ' + creator.first_name + ' ' + creator.last_name : ''}`}
                      >
                        <span className="text-[7px] font-bold text-white leading-none drop-shadow-sm">
                          {pInitials}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Legend: planners + status */}
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-border">
            {/* Planner colors */}
            {(() => {
              const planners = new Map<string, { name: string; color: string; initials: string }>()
              for (const loc of locationRows) {
                for (const v of loc.visits) {
                  const c = v.creator as { id: string; first_name: string; last_name: string } | undefined
                  if (c && !planners.has(c.id)) {
                    planners.set(c.id, {
                      name: `${c.first_name} ${c.last_name}`,
                      color: plannerColor(c.id),
                      initials: initials(c.first_name, c.last_name),
                    })
                  }
                }
              }
              return Array.from(planners.values()).map(p => (
                <div key={p.name} className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded-sm flex items-center justify-center" style={{ backgroundColor: p.color }}>
                    <span className="text-[6px] font-bold text-white">{p.initials}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{p.name}</span>
                </div>
              ))
            })()}
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-gray-400 border-2 border-emerald-500" />
              <span className="text-[10px] text-muted-foreground">Terminee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-gray-300 opacity-30" />
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
