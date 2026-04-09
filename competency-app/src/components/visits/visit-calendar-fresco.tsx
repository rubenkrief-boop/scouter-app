'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import type { VisitWithRelations, GeographicZone, UserRole } from '@/lib/types'

// ============================================
// Planner colors + initials
// ============================================

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

function getInitials(firstName?: string, lastName?: string): string {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}

// ============================================
// Constants
// ============================================

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// ============================================
// Component
// ============================================

interface CalendarFrescoProps {
  visits: VisitWithRelations[]
  year?: number
  userRole?: UserRole
  myLocationIds?: string[]
}

export function VisitCalendarFresco({ visits, year: propYear, userRole, myLocationIds = [] }: CalendarFrescoProps) {
  const year = propYear ?? new Date().getFullYear()

  // Calendar constants derived from year (memoized: only recompute when year changes)
  const { daysInMonth, totalDays } = useMemo(() => {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    const days = [...MONTH_DAYS]
    if (isLeap) days[1] = 29
    return { daysInMonth: days, totalDays: days.reduce((a, b) => a + b, 0) }
  }, [year])

  const yearVisits = useMemo(() => {
    return visits.filter(v => {
      const start = new Date(v.start_date + 'T00:00:00')
      const end = new Date(v.end_date + 'T00:00:00')
      return start.getFullYear() === year || end.getFullYear() === year
    })
  }, [visits, year])

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

  const today = new Date()
  const todayDoy = today.getFullYear() === year
    ? dateToDayOfYear(today.toISOString().split('T')[0])
    : -1

  // Collect unique planners for legend
  const planners = useMemo(() => {
    const map = new Map<string, { name: string; color: string; initials: string }>()
    for (const v of yearVisits) {
      const c = v.creator as { id: string; first_name: string; last_name: string } | undefined
      if (c && !map.has(c.id)) {
        map.set(c.id, {
          name: `${c.first_name} ${c.last_name}`,
          color: plannerColor(c.id),
          initials: getInitials(c.first_name, c.last_name),
        })
      }
    }
    return Array.from(map.values())
  }, [yearVisits])

  if (locationRows.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Fresque {year}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Month headers */}
            <div className="flex mb-2">
              <div className="w-[240px] flex-shrink-0" />
              <div className="flex-1 flex">
                {MONTH_SHORT.map((label, i) => {
                  const widthPct = (daysInMonth[i] / totalDays) * 100
                  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === i
                  return (
                    <div
                      key={label}
                      className={`text-center text-xs font-semibold py-1.5 border-l border-border/40 first:border-l-0 ${
                        isCurrentMonth ? 'bg-primary/10 text-primary rounded-t-md' : 'text-muted-foreground'
                      }`}
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
              const target = userRole === 'super_admin'
                ? (loc.zone?.target_visits_admin ?? 0)
                : userRole === 'manager'
                  ? (loc.zone?.target_visits_manager ?? 0)
                  : (loc.zone?.target_visits_resp ?? 0)
              const isMyCenter = myLocationIds.length === 0 || myLocationIds.includes(loc.id)
              const completedCount = loc.visits.filter(v => v.status === 'completed').length
              const plannedCount = loc.visits.filter(v => v.status === 'planned').length
              const totalActive = completedCount + plannedCount

              return (
                <div key={loc.id} className="flex items-center mb-1.5 group">
                  {/* Location label */}
                  <div className="w-[240px] flex-shrink-0 pr-3 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                      style={{ backgroundColor: zoneColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{loc.name}</span>
                        {target > 0 && isMyCenter && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-5 font-mono flex-shrink-0 ${
                              totalActive >= target ? 'border-green-400 text-green-600 bg-green-50' : 'border-orange-400 text-orange-600 bg-orange-50'
                            }`}
                          >
                            {totalActive}/{target}
                          </Badge>
                        )}
                      </div>
                      {(loc.city || loc.zone) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {loc.city && <span className="text-[10px] text-muted-foreground">{loc.city}</span>}
                          {loc.zone && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5" style={{ borderColor: zoneColor, color: zoneColor }}>
                              {loc.zone.name}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-10 bg-muted/20 rounded-md border border-border/30 group-hover:bg-muted/40 transition-colors">
                    {/* Month dividers */}
                    {daysInMonth.map((_, i) => {
                      if (i === 0) return null
                      let offset = 0
                      for (let j = 0; j < i; j++) offset += daysInMonth[j]
                      const leftPct = (offset / totalDays) * 100
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-border/20"
                          style={{ left: `${leftPct}%` }}
                        />
                      )
                    })}

                    {/* Today marker */}
                    {todayDoy >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 rounded-full"
                        style={{ left: `${(todayDoy / totalDays) * 100}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                    )}

                    {/* Visit bars */}
                    {loc.visits.map(v => {
                      const startDay = dateToDayOfYear(v.start_date)
                      const endDay = dateToDayOfYear(v.end_date)
                      const leftPct = (startDay / totalDays) * 100
                      const widthPct = Math.max(2, ((endDay - startDay + 1) / totalDays) * 100)
                      const isCompleted = v.status === 'completed'
                      const isCancelled = v.status === 'cancelled'
                      const creator = v.creator as { id: string; first_name: string; last_name: string } | undefined
                      const pColor = creator ? plannerColor(creator.id) : '#6B7280'
                      const pInit = creator ? getInitials(creator.first_name, creator.last_name) : '?'
                      const bgColor = isCancelled ? '#D1D5DB' : pColor

                      const dateLabel = new Date(v.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                      const endLabel = v.start_date !== v.end_date
                        ? ' → ' + new Date(v.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                        : ''

                      return (
                        <div
                          key={v.id}
                          className="absolute top-1 bottom-1 rounded-md cursor-pointer transition-all hover:scale-y-110 hover:z-10 flex items-center gap-1 px-1 overflow-hidden shadow-sm"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: bgColor,
                            opacity: isCancelled ? 0.25 : 0.95,
                            border: isCompleted ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.3)',
                          }}
                          title={`${creator?.first_name ?? ''} ${creator?.last_name ?? ''}\n${loc.name} — ${dateLabel}${endLabel}\n${isCompleted ? '✅ Terminée' : isCancelled ? '❌ Annulée' : '📅 Planifiée'}`}
                        >
                          <span className="text-[10px] font-bold text-white leading-none drop-shadow-md whitespace-nowrap">
                            {pInit}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-5 mt-4 pt-3 border-t border-border">
              {planners.map(p => (
                <div key={p.name} className="flex items-center gap-2">
                  <div className="w-6 h-5 rounded flex items-center justify-center shadow-sm" style={{ backgroundColor: p.color }}>
                    <span className="text-[8px] font-bold text-white">{p.initials}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{p.name}</span>
                </div>
              ))}
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-5 h-4 rounded bg-gray-400 border-2 border-emerald-500" />
                <span className="text-xs text-muted-foreground">Terminee</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-4 rounded bg-gray-300 opacity-25" />
                <span className="text-xs text-muted-foreground">Annulee</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-red-500 rounded-full" />
                <span className="text-xs text-muted-foreground">Aujourd&apos;hui</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
