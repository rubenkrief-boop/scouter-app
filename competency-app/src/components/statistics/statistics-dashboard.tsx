'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, AreaChart, Area, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import {
  Users, TrendingUp, Award, BarChart3, Activity,
  AlertTriangle, Target, ChevronDown, ChevronUp, MapPin,
} from 'lucide-react'
import type { ModuleGlobalStat, UserSummary, ProgressionData, GapAnalysisResult } from '@/lib/actions/statistics'

interface StatisticsDashboardProps {
  moduleStats: ModuleGlobalStat[]
  userSummaries: UserSummary[]
  chartColors: { actual: string; expected: string }
  progressionData: ProgressionData
  gapAnalysis: GapAnalysisResult
}

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.fill || entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold ml-auto">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

function CustomAreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.stroke }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold ml-auto">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

function GapTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700">
      <p className="font-semibold text-sm mb-2">{data?.fullName || label}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Score actuel :</span>
          <span className="font-semibold">{data?.avgActual}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-300">Score attendu :</span>
          <span className="font-semibold">{data?.avgExpected}%</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-gray-700 pt-1">
          <span className="text-gray-300">Ecart :</span>
          <span className="font-semibold text-red-400">-{data?.gap}%</span>
        </div>
        {data?.workersBelowCount > 0 && (
          <div className="text-xs text-amber-400 mt-1">
            {data.workersBelowCount} collaborateur{data.workersBelowCount > 1 ? 's' : ''} sous le seuil
          </div>
        )}
      </div>
    </div>
  )
}

function getGapColor(gap: number) {
  if (gap > 30) return '#ef4444'   // red
  if (gap > 15) return '#f97316'   // orange
  if (gap > 5) return '#eab308'    // yellow
  return '#22c55e'                  // green
}

function getAlertBadge(gap: number) {
  if (gap > 30) return { label: 'Critique', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
  if (gap > 15) return { label: 'Attention', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' }
  return { label: 'A surveiller', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' }
}

export function StatisticsDashboard({
  moduleStats,
  userSummaries,
  chartColors,
  progressionData,
  gapAnalysis,
}: StatisticsDashboardProps) {
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [progressionWorker, setProgressionWorker] = useState<string>('team')
  const [expandedGapModule, setExpandedGapModule] = useState<string | null>(null)
  const [alertLimit, setAlertLimit] = useState(10)

  // Extract unique locations
  const locations = useMemo(() => {
    const set = new Set(userSummaries.map(u => u.location_name).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [userSummaries])

  // Filter users by location
  const filteredUsers = useMemo(() => {
    if (filterLocation === 'all') return userSummaries
    return userSummaries.filter(u => u.location_name === filterLocation)
  }, [userSummaries, filterLocation])

  // KPIs
  const totalUsers = filteredUsers.length
  const totalEvals = filteredUsers.reduce((sum, u) => sum + u.eval_count, 0)
  const globalAvg = totalUsers > 0
    ? Math.round((filteredUsers.reduce((sum, u) => sum + u.overall_avg, 0) / totalUsers) * 10) / 10
    : 0
  const topPerformer = filteredUsers[0]

  // Bar chart data: average score per module
  const barData = useMemo(() => {
    if (filteredUsers.length === 0) return []

    const moduleMap = new Map<string, { code: string; name: string; scores: number[] }>()
    for (const user of filteredUsers) {
      for (const m of user.modules) {
        if (!moduleMap.has(m.module_code)) {
          moduleMap.set(m.module_code, { code: m.module_code, name: m.module_name, scores: [] })
        }
        moduleMap.get(m.module_code)!.scores.push(m.avg_score)
      }
    }

    return Array.from(moduleMap.values()).map(m => ({
      name: m.code,
      fullName: `${m.code} - ${m.name}`,
      avg: Math.round((m.scores.reduce((a, b) => a + b, 0) / m.scores.length) * 10) / 10,
      count: m.scores.length,
    }))
  }, [filteredUsers])

  // Radar chart: compare users on a selected module or overall
  const radarCompareData = useMemo(() => {
    if (filteredUsers.length === 0) return []

    if (selectedModule === 'all') {
      return barData.map(b => ({
        module: b.name,
        score: b.avg,
        fullMark: 100,
      }))
    }

    return filteredUsers
      .map(u => {
        const mod = u.modules.find(m => m.module_code === selectedModule)
        return mod ? {
          module: `${u.first_name} ${u.last_name.charAt(0)}.`,
          score: mod.avg_score,
          fullMark: 100,
        } : null
      })
      .filter(Boolean) as { module: string; score: number; fullMark: number }[]
  }, [filteredUsers, selectedModule, barData])

  // Progression chart data
  const progressionChartData = useMemo(() => {
    if (progressionWorker === 'team') {
      return progressionData.teamTimeline
    }
    const worker = progressionData.workers.find(w => w.userId === progressionWorker)
    return worker?.points ?? []
  }, [progressionData, progressionWorker])

  // Gap analysis chart data (horizontal bar)
  const gapChartData = useMemo(() => {
    return gapAnalysis.modules
      .filter(m => m.gap > 0) // Only show modules with actual gaps
      .map(m => ({
        name: m.moduleCode,
        fullName: `${m.moduleCode} - ${m.moduleName}`,
        gap: m.gap,
        avgActual: m.avgActual,
        avgExpected: m.avgExpected,
        workersBelowCount: m.workersBelow.length,
        fill: getGapColor(m.gap),
      }))
  }, [gapAnalysis.modules])

  // Alerts KPIs
  const criticalAlerts = gapAnalysis.alerts.filter(a => a.gap > 30).length
  const warningAlerts = gapAnalysis.alerts.filter(a => a.gap > 15 && a.gap <= 30).length

  // Color scale for bars
  function getBarColor(score: number) {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  if (userSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <BarChart3 className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">Aucune evaluation completee</p>
        <p className="text-sm">Les statistiques apparaitront une fois des evaluations terminees.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrer par lieu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les lieux</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedModule} onValueChange={setSelectedModule}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Module pour le radar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vue globale (moyenne par module)</SelectItem>
            {barData.map(b => (
              <SelectItem key={b.name} value={b.name}>{b.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-6 w-6 text-primary" />}
          label="Collaborateurs evalues"
          value={String(totalUsers)}
          sub={`${totalEvals} evaluation${totalEvals > 1 ? 's' : ''} au total`}
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          label="Score moyen global"
          value={`${globalAvg}%`}
          sub={filterLocation !== 'all' ? filterLocation : 'Tous les lieux'}
        />
        <StatCard
          icon={<Award className="h-6 w-6 text-primary" />}
          label="Meilleur score"
          value={topPerformer ? `${topPerformer.overall_avg}%` : '-'}
          sub={topPerformer ? `${topPerformer.first_name} ${topPerformer.last_name}` : undefined}
        />
        <StatCard
          icon={<AlertTriangle className="h-6 w-6 text-primary" />}
          label="Alertes"
          value={String(gapAnalysis.alerts.length)}
          sub={criticalAlerts > 0 ? `${criticalAlerts} critique${criticalAlerts > 1 ? 's' : ''}` : 'Aucune alerte critique'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart: avg per module */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score moyen par module</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="avg" name="Moyenne" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={getBarColor(entry.avg)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">Aucune donnee</p>
            )}
          </CardContent>
        </Card>

        {/* Radar: global or per-module */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedModule === 'all' ? 'Vue radar globale' : `Comparaison : ${selectedModule}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarCompareData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarCompareData}>
                  <PolarGrid stroke="var(--border)" strokeOpacity={0.4} gridType="circle" />
                  <PolarAngleAxis dataKey="module" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} tickCount={5} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke={chartColors.actual}
                    fill={chartColors.actual}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Legend />
                  <RechartsTooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">Aucune donnee</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== SECTION: Evolution temporelle ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" />
              Evolution temporelle
            </CardTitle>
            <Select value={progressionWorker} onValueChange={setProgressionWorker}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Selectionner un collaborateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Moyenne de l&apos;equipe</SelectItem>
                {progressionData.workers.map(w => (
                  <SelectItem key={w.userId} value={w.userId}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {progressionChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={progressionChartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.actual} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColors.actual} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <RechartsTooltip content={<CustomAreaTooltip />} />
                <ReferenceLine
                  y={70}
                  stroke={chartColors.expected}
                  strokeDasharray="8 4"
                  label={{ value: 'Seuil 70%', position: 'right', fontSize: 10, fill: chartColors.expected }}
                />
                <Area
                  type="monotone"
                  dataKey="avgScore"
                  name={progressionWorker === 'team' ? 'Moyenne equipe' : 'Score'}
                  stroke={chartColors.actual}
                  fill="url(#colorScore)"
                  strokeWidth={2.5}
                  dot={{ fill: chartColors.actual, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          ) : progressionChartData.length === 1 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Un seul point de donnee disponible ({progressionChartData[0].dateLabel} : {progressionChartData[0].avgScore}%)</p>
              <p className="text-xs mt-1">Les courbes d&apos;evolution apparaitront apres plusieurs evaluations</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Aucun historique de snapshots disponible</p>
              <p className="text-xs mt-1">Les courbes apparaitront apres la sauvegarde d&apos;evaluations continues</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== SECTION: Gap Analysis ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            Analyse des ecarts (Gap Analysis)
            {gapChartData.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {gapChartData.length} module{gapChartData.length > 1 ? 's' : ''} avec ecart
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gapChartData.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={Math.max(200, gapChartData.length * 45 + 40)}>
                <BarChart
                  data={gapChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} horizontal={false} />
                  <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <RechartsTooltip content={<GapTooltip />} />
                  <Bar dataKey="gap" name="Ecart" radius={[0, 4, 4, 0]} barSize={24}>
                    {gapChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legende couleur */}
              <div className="flex gap-4 text-xs text-muted-foreground justify-center">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500" /> Critique (&gt;30%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-orange-500" /> Attention (&gt;15%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-yellow-500" /> A surveiller (&gt;5%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-green-500" /> Conforme (&le;5%)
                </span>
              </div>

              {/* Detail par module : collaborateurs en dessous */}
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium text-muted-foreground">Detail par module :</p>
                {gapAnalysis.modules
                  .filter(m => m.workersBelow.length > 0)
                  .map(mod => (
                    <div key={mod.moduleId} className="border border-gray-100 dark:border-gray-800 rounded-lg">
                      <button
                        onClick={() => setExpandedGapModule(expandedGapModule === mod.moduleId ? null : mod.moduleId)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getGapColor(mod.gap) }}
                          />
                          <span className="text-sm font-medium">
                            {mod.moduleCode} - {mod.moduleName}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {mod.workersBelow.length} sous le seuil
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {mod.avgActual}% / {mod.avgExpected}%
                          </span>
                          {expandedGapModule === mod.moduleId
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                      </button>
                      {expandedGapModule === mod.moduleId && (
                        <div className="px-3 pb-3 space-y-1.5">
                          {mod.workersBelow.map(w => (
                            <div key={w.userId} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-900/30 rounded text-sm">
                              <span>{w.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{w.score}% / {w.expected}%</span>
                                <Badge className={getAlertBadge(w.gap).className + ' text-xs'}>
                                  -{w.gap}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Target className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Aucun ecart detecte</p>
              <p className="text-xs mt-1">Les ecarts apparaitront quand des scores attendus seront configures dans les profils metier</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== SECTION: Alertes ===== */}
      {gapAnalysis.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Alertes - Collaborateurs sous le seuil
              <Badge variant="destructive" className="ml-2 text-xs">
                {gapAnalysis.alerts.length} alerte{gapAnalysis.alerts.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {gapAnalysis.alerts.slice(0, alertLimit).map((alert, i) => {
                const badge = getAlertBadge(alert.gap)
                return (
                  <div
                    key={`${alert.userId}-${alert.moduleCode}-${i}`}
                    className="border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{alert.name}</p>
                        {alert.locationName && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {alert.locationName}
                          </p>
                        )}
                      </div>
                      <Badge className={badge.className + ' text-xs flex-shrink-0'}>
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <p className="text-xs text-muted-foreground">
                        {alert.moduleCode} - {alert.moduleName}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Actuel</span>
                            <span className="font-medium">{alert.score}%</span>
                          </div>
                          <Progress value={alert.score} className="h-1.5" />
                        </div>
                        <div className="text-xs text-muted-foreground px-2">vs</div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Attendu</span>
                            <span className="font-medium">{alert.expected}%</span>
                          </div>
                          <Progress value={alert.expected} className="h-1.5" />
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          Ecart : -{alert.gap}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {gapAnalysis.alerts.length > alertLimit && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setAlertLimit(prev => prev + 10)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                >
                  Voir plus ({gapAnalysis.alerts.length - alertLimit} restantes)
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Classement des collaborateurs
            {filterLocation !== 'all' && (
              <Badge variant="secondary" className="ml-2 text-xs">{filterLocation}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Collaborateur</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead className="text-center">Evaluations</TableHead>
                <TableHead className="text-center">Score global</TableHead>
                <TableHead className="w-48">Progression</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user, index) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.location_name ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{user.eval_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold text-sm ${
                      user.overall_avg >= 80 ? 'text-green-600' :
                      user.overall_avg >= 60 ? 'text-yellow-600' :
                      user.overall_avg >= 40 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {user.overall_avg}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Progress
                      value={user.overall_avg}
                      className="h-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun collaborateur evalue
                    {filterLocation !== 'all' && ` pour ${filterLocation}`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
