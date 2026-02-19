import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { ModuleProgressList } from '@/components/dashboard/module-progress-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'

export default async function EvaluationResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select(`
      *,
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
      job_profile:job_profiles(name)
    `)
    .eq('id', id)
    .single()

  if (!evaluation) notFound()

  // Get module scores via RPC (now uses weighted scoring)
  const { data: moduleScores } = await supabase
    .rpc('get_module_scores', { p_evaluation_id: id })

  // Get expected scores from job_profile_competencies (auto-calculated weighted averages)
  let expectedScores: Record<string, number> = {}
  if (evaluation.job_profile_id) {
    const { data: jpComps } = await supabase
      .from('job_profile_competencies')
      .select('*')
      .eq('job_profile_id', evaluation.job_profile_id)

    jpComps?.forEach((jpc) => {
      expectedScores[jpc.module_id] = jpc.expected_score
    })
  }

  // Transform to radar data
  const radarData: RadarDataPoint[] = (moduleScores ?? []).map((ms: any) => ({
    module: `${ms.module_code} - ${ms.module_name}`,
    actual: parseFloat(ms.completion_pct) || 0,
    expected: expectedScores[ms.module_id] ?? 0,
    fullMark: 100,
  }))

  // Calculate overall stats
  const totalModules = radarData.length
  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected).length
  const overallAvg = totalModules > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / totalModules)
    : 0

  const chartColors = await getChartColors()
  const audioName = `${evaluation.audioprothesiste?.first_name ?? ''} ${evaluation.audioprothesiste?.last_name ?? ''}`

  return (
    <div>
      <Header
        title={`Résultats - ${audioName}`}
        description={evaluation.job_profile?.name ?? 'Aucun profil métier'}
      />
      <div className="p-6 space-y-6">
        {/* Back + summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/evaluator/evaluations"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux évaluations
            </Link>
            <Link
              href={`/evaluator/evaluations/${id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
              Modifier les scores
            </Link>
          </div>
          {evaluation.evaluated_at && (
            <span className="text-xs text-muted-foreground">
              Dernière mise à jour : {new Date(evaluation.evaluated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
          <div className="flex gap-3">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              Score global : {overallAvg}%
            </Badge>
            {modulesAboveExpected === totalModules ? (
              <Badge variant="secondary" className="bg-green-100 text-green-700 text-sm py-1 px-3">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Tous les modules validés
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-sm py-1 px-3">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                {modulesAboveExpected}/{totalModules} modules validés
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Bilan de compétences</CardTitle>
            </CardHeader>
            <CardContent>
              <CompetencyRadarChart
                data={radarData}
                expectedLabel="Attendu"
                actualLabel="Niveau actuel"
                colors={chartColors}
              />
              {/* Code legend */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  {radarData.map((d, i) => {
                    const parts = d.module.split(' - ')
                    const code = parts[0]?.trim() || ''
                    const name = parts[1]?.trim() || d.module
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{code}</span>
                        <span className="truncate">{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progression par module</CardTitle>
            </CardHeader>
            <CardContent>
              <ModuleProgressList data={radarData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
