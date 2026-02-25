'use client'

import { useEffect, useState } from 'react'
import { History, TrendingUp, User, Calendar } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSnapshotHistory } from '@/lib/actions/evaluations'
import type { SnapshotHistoryEntry, ModuleScore } from '@/lib/types'

interface EvaluationHistoryProps {
  evaluationId: string
}

// Couleurs pour les lignes du graphique
const LINE_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#c026d3', '#65a30d', '#ea580c',
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EvaluationHistory({ evaluationId }: EvaluationHistoryProps) {
  const [snapshots, setSnapshots] = useState<SnapshotHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getSnapshotHistory(evaluationId)
      setSnapshots(data)
      setLoading(false)
    }
    load()
  }, [evaluationId])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement de l&apos;historique...
        </CardContent>
      </Card>
    )
  }

  if (snapshots.length === 0) {
    return null // Pas d'historique à montrer
  }

  // Préparer les données pour le graphique d'évolution
  // Les snapshots sont triés DESC, on les inverse pour le graphique (chronologique)
  const chronological = [...snapshots].reverse()

  // Extraire les noms de modules uniques
  const moduleNames = new Map<string, string>()
  for (const snap of chronological) {
    const scores = snap.module_scores as ModuleScore[] | null
    if (scores) {
      for (const ms of scores) {
        if (!moduleNames.has(ms.module_id)) {
          moduleNames.set(ms.module_id, `${ms.module_code} - ${ms.module_name}`)
        }
      }
    }
  }

  // Construire les data points pour le LineChart
  const chartData = chronological.map(snap => {
    const point: Record<string, any> = {
      date: formatDate(snap.snapshot_date),
      fullDate: snap.snapshot_date,
    }
    const scores = snap.module_scores as ModuleScore[] | null
    if (scores) {
      for (const ms of scores) {
        point[ms.module_id] = Math.round(ms.completion_pct * 10) / 10
      }
    }
    return point
  })

  const moduleEntries = Array.from(moduleNames.entries())

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Historique des évaluations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="evolution" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="evolution" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Évolution
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Chronologie
            </TabsTrigger>
          </TabsList>

          <TabsContent value="evolution">
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    fontSize={11}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    fontSize={11}
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  {moduleEntries.map(([moduleId, moduleName], i) => (
                    <Line
                      key={moduleId}
                      type="monotone"
                      dataKey={moduleId}
                      name={moduleName}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                Le graphique d&apos;évolution sera disponible après au moins 2 sauvegardes.
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {snapshots.map((snap, i) => {
                const scores = snap.module_scores as ModuleScore[] | null
                const avgScore = scores && scores.length > 0
                  ? Math.round(scores.reduce((sum, s) => sum + s.completion_pct, 0) / scores.length)
                  : null

                return (
                  <div
                    key={snap.snapshot_id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${i === 0 ? 'border-violet-200 bg-violet-50/50' : 'border-gray-100 bg-gray-50/50'}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-full ${i === 0 ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'}`}>
                      <History className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{formatDateTime(snap.snapshot_date)}</span>
                        {i === 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                            Dernier
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <User className="h-3 w-3" />
                        {snap.snapshot_by_name}
                        {avgScore !== null && (
                          <span className="ml-2 font-medium text-gray-600">
                            Score moyen : {avgScore}%
                          </span>
                        )}
                      </div>
                      {scores && scores.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {scores.map(ms => (
                            <span
                              key={ms.module_id}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white border font-medium"
                            >
                              {ms.module_code}: {Math.round(ms.completion_pct)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
