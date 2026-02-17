'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Users, TrendingUp, Award, BarChart3 } from 'lucide-react'
import type { ModuleGlobalStat, UserSummary } from '@/lib/actions/statistics'

interface StatisticsDashboardProps {
  moduleStats: ModuleGlobalStat[]
  userSummaries: UserSummary[]
  chartColors: { actual: string; expected: string }
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
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.fill }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold ml-auto">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

export function StatisticsDashboard({
  moduleStats,
  userSummaries,
  chartColors,
}: StatisticsDashboardProps) {
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [selectedModule, setSelectedModule] = useState<string>('all')

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
      // Show overall avg per module (group averages)
      return barData.map(b => ({
        module: b.name,
        score: b.avg,
        fullMark: 100,
      }))
    }

    // Show all users' scores for a specific module
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
        <p className="text-lg font-medium">Aucune évaluation complétée</p>
        <p className="text-sm">Les statistiques apparaîtront une fois des évaluations terminées.</p>
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
          label="Collaborateurs évalués"
          value={String(totalUsers)}
          sub={`${totalEvals} évaluation${totalEvals > 1 ? 's' : ''} au total`}
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
          icon={<BarChart3 className="h-6 w-6 text-primary" />}
          label="Modules évalués"
          value={String(barData.length)}
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
              <p className="text-muted-foreground text-center py-10">Aucune donnée</p>
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
              <p className="text-muted-foreground text-center py-10">Aucune donnée</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                <TableHead className="text-center">Évaluations</TableHead>
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
                    Aucun collaborateur évalué
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
