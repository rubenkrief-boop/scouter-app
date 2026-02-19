import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { ModuleProgressList } from '@/components/dashboard/module-progress-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  // Get module scores via RPC
  const { data: moduleScores } = await supabase
    .rpc('get_module_scores', { p_evaluation_id: id })

  // Get expected scores from job_profile_competencies
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
  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected && d.expected > 0).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length
  const overallAvg = totalModules > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / totalModules)
    : 0

  const chartColors = await getChartColors()
  const audioName = `${evaluation.audioprothesiste?.first_name ?? ''} ${evaluation.audioprothesiste?.last_name ?? ''}`

  return (
    <div>
      <Header
        title={`Bilan de compétences`}
        description={`${audioName} — ${evaluation.job_profile?.name ?? 'Aucun profil métier'}`}
      />
      <div className="p-6 space-y-6">
        {/* Navigation bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/evaluator/evaluations"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux évaluations
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {evaluation.evaluated_at && (
              <span className="text-xs text-muted-foreground">
                Mis à jour le {new Date(evaluation.evaluated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            <Link href={`/evaluator/evaluations/${id}`}>
              <Button className="bg-rose-600 hover:bg-rose-700">
                <Pencil className="h-4 w-4 mr-2" />
                Modifier les scores
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-violet-600">{overallAvg}%</p>
              <p className="text-xs text-muted-foreground mt-1">Score global</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-gray-700">{totalModules}</p>
              <p className="text-xs text-muted-foreground mt-1">Modules évalués</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {modulesWithExpected > 0 ? (
                modulesAboveExpected === modulesWithExpected ? (
                  <>
                    <p className="text-3xl font-bold text-emerald-600 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-6 w-6" />
                      {modulesAboveExpected}/{modulesWithExpected}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Modules validés</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-amber-600 flex items-center justify-center gap-2">
                      <AlertTriangle className="h-6 w-6" />
                      {modulesAboveExpected}/{modulesWithExpected}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Modules validés</p>
                  </>
                )
              ) : (
                <>
                  <p className="text-3xl font-bold text-gray-400">-</p>
                  <p className="text-xs text-muted-foreground mt-1">Aucun attendu défini</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* FULL WIDTH Radar Chart — the main attraction */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-lg font-semibold">Bilan de compétences</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparaison entre le niveau actuel et le niveau attendu
              {evaluation.job_profile?.name ? ` pour le profil « ${evaluation.job_profile.name} »` : ''}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <CompetencyRadarChart
              data={radarData}
              expectedLabel="Attendu"
              actualLabel="Niveau actuel"
              colors={chartColors}
              fullSize
            />
          </CardContent>
        </Card>

        {/* Module detail list below */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Détail par module</CardTitle>
            <p className="text-xs text-muted-foreground">
              Trié par écart avec l&apos;attendu — les modules nécessitant le plus de progression apparaissent en premier
            </p>
          </CardHeader>
          <CardContent>
            <ModuleProgressList data={radarData} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
