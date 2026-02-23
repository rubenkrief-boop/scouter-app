import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, CheckCircle2, AlertTriangle, User } from 'lucide-react'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModuleSidebar } from '@/components/dashboard/module-sidebar'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { ScouterTrigger } from '@/components/animations/scouter-trigger'

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
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name, job_title, avatar_url),
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

  // Get module colors from modules table
  const moduleIds = (moduleScores ?? []).map((ms: any) => ms.module_id)
  let moduleColors: Record<string, string> = {}
  let moduleIcons: Record<string, string> = {}
  if (moduleIds.length > 0) {
    const { data: modulesData } = await supabase
      .from('modules')
      .select('id, color, icon')
      .in('id', moduleIds)

    modulesData?.forEach((m) => {
      if (m.color) moduleColors[m.id] = m.color
      if (m.icon) moduleIcons[m.id] = m.icon
    })
  }

  // Transform to radar data
  const radarData: RadarDataPoint[] = (moduleScores ?? []).map((ms: any) => ({
    module: `${ms.module_code} - ${ms.module_name}`,
    actual: parseFloat(ms.completion_pct) || 0,
    expected: expectedScores[ms.module_id] ?? 0,
    fullMark: 100,
    moduleColor: moduleColors[ms.module_id] || '#6366f1',
    moduleIcon: moduleIcons[ms.module_id] || '',
  }))

  // Calculate overall stats
  const totalModules = radarData.length
  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected && d.expected > 0).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length
  const overallAvg = totalModules > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / totalModules)
    : 0

  // Scouter explosion trigger: 90%+ overall OR all modules at expected
  const shouldTriggerScouter = (modulesWithExpected > 0 && modulesAboveExpected === modulesWithExpected) || overallAvg >= 90

  const chartColors = await getChartColors()
  const audioFirstName = evaluation.audioprothesiste?.first_name ?? ''
  const audioLastName = evaluation.audioprothesiste?.last_name ?? ''
  const audioName = `${audioFirstName} ${audioLastName}`.trim()
  const jobTitle = evaluation.audioprothesiste?.job_title || evaluation.job_profile?.name || 'Audioprothésiste'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <ScouterTrigger
        score={overallAvg}
        triggered={shouldTriggerScouter}
        storageKey={`scouter-eval-${id}`}
      />
      {/* Top bar — Nom + fonction bien visible */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/evaluator/evaluations"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            {/* Avatar + Name + Job Title — PROMINENT */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                {evaluation.audioprothesiste?.avatar_url ? (
                  <img
                    src={evaluation.audioprothesiste.avatar_url}
                    alt={audioName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  {audioName}
                </h1>
                <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                  {jobTitle}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {evaluation.evaluated_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(evaluation.evaluated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
            <Link href={`/evaluator/evaluations/${id}`}>
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Pencil className="h-4 w-4 mr-2" />
                Modifier les scores
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main content — 2 columns: huge radar left + module list right */}
      <div className="flex">
        {/* LEFT — Giant radar chart */}
        <div className="flex-1 p-6">
          {/* Mini stats row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-violet-600">{overallAvg}%</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Score global</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{totalModules}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Modules évalués</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 text-center">
                {modulesWithExpected > 0 ? (
                  <>
                    <p className={`text-2xl font-bold flex items-center justify-center gap-1 ${modulesAboveExpected === modulesWithExpected ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {modulesAboveExpected === modulesWithExpected && <CheckCircle2 className="h-5 w-5" />}
                      {modulesAboveExpected !== modulesWithExpected && <AlertTriangle className="h-5 w-5" />}
                      {modulesAboveExpected}/{modulesWithExpected}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Modules validés</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-400">-</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Aucun attendu</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* HUGE Radar */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2 pt-4">
              <CompetencyRadarChart
                data={radarData}
                expectedLabel="Attendu"
                actualLabel="Niveau actuel"
                colors={chartColors}
                fullSize
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Module list sidebar (collapsible) */}
        <div className="w-[340px] flex-shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <ModuleSidebar data={radarData} />
        </div>
      </div>
    </div>
  )
}
