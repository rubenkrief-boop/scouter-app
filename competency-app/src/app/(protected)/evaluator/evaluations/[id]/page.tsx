import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { BarChart3, Lock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { EvaluationForm } from '@/components/evaluations/evaluation-form'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarDataPoint, QualifierWithOptions } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { getQualifiersByModule } from '@/lib/actions/modules'
import { getAuthProfile } from '@/lib/supabase/auth-cache'

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile: currentProfile } = await getAuthProfile()
  if (!user || !currentProfile) redirect('/auth/login')

  const supabase = await createClient()

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluator_id(first_name, last_name),
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
      job_profile:job_profiles(name)
    `)
    .eq('id', id)
    .single()

  if (!evaluation) notFound()

  // If evaluation has a job profile, only fetch modules included in that profile
  let profileModuleIds: string[] | null = null
  if (evaluation.job_profile_id) {
    const { data: jpCompsForFilter } = await supabase
      .from('job_profile_competencies')
      .select('module_id')
      .eq('job_profile_id', evaluation.job_profile_id)
    if (jpCompsForFilter && jpCompsForFilter.length > 0) {
      profileModuleIds = jpCompsForFilter.map(jpc => jpc.module_id)
    }
  }

  // Fetch top-level modules with competencies (filtered by job profile if applicable)
  let modulesQuery = supabase
    .from('modules')
    .select('*, competencies(*)')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  if (profileModuleIds && profileModuleIds.length > 0) {
    modulesQuery = modulesQuery.in('id', profileModuleIds)
  }

  const { data: modules } = await modulesQuery

  // Fetch qualifiers — filtered by job profile if linked qualifiers exist
  let profileQualifierIds: string[] | null = null
  if (evaluation.job_profile_id) {
    const { data: jpQualifiers } = await supabase
      .from('job_profile_qualifiers')
      .select('qualifier_id')
      .eq('job_profile_id', evaluation.job_profile_id)
    if (jpQualifiers && jpQualifiers.length > 0) {
      profileQualifierIds = jpQualifiers.map(jpq => jpq.qualifier_id)
    }
  }

  let qualifiersQuery = supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .eq('is_active', true)
    .order('sort_order')

  if (profileQualifierIds && profileQualifierIds.length > 0) {
    qualifiersQuery = qualifiersQuery.in('id', profileQualifierIds)
  }

  const { data: qualifiers } = await qualifiersQuery

  // Build qualifiers par module
  const moduleIds = (modules ?? []).map((m: any) => m.id)
  const qualifiersByModule = await getQualifiersByModule(
    moduleIds,
    (qualifiers ?? []) as QualifierWithOptions[]
  )

  // Determiner si le manager est en lecture seule (evaluation hors equipe)
  let isReadOnly = false
  if (currentProfile.role === 'manager') {
    // Verifier si le collaborateur evalue fait partie de l'equipe du manager
    const { data: workerProfile } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', evaluation.audioprothesiste_id)
      .single()

    if (workerProfile?.manager_id !== currentProfile.id) {
      isReadOnly = true
    }
  }

  // Fetch existing results
  const { data: existingResults } = await supabase
    .from('evaluation_results')
    .select('*, evaluation_result_qualifiers(*)')
    .eq('evaluation_id', id)

  // Build initial state from existing results
  const initialState: Record<string, Record<string, string>> = {}
  existingResults?.forEach((result) => {
    initialState[result.competency_id] = {}
    result.evaluation_result_qualifiers?.forEach((erq: any) => {
      initialState[result.competency_id][erq.qualifier_id] = erq.qualifier_option_id
    })
  })

  // Fetch radar data (module scores via RPC)
  const { data: moduleScores } = await supabase
    .rpc('get_module_scores', { p_evaluation_id: id })

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

  // Get module colors for radar labels
  const scoreModuleIds = (moduleScores ?? []).map((ms: any) => ms.module_id)
  let moduleColorMap: Record<string, string> = {}
  if (scoreModuleIds.length > 0) {
    const { data: modColors } = await supabase
      .from('modules')
      .select('id, color')
      .in('id', scoreModuleIds)
    modColors?.forEach((m) => {
      if (m.color) moduleColorMap[m.id] = m.color
    })
  }

  const radarData: RadarDataPoint[] = (moduleScores ?? []).map((ms: any) => ({
    module: `${ms.module_code} - ${ms.module_name}`,
    actual: parseFloat(ms.completion_pct) || 0,
    expected: expectedScores[ms.module_id] ?? 70,
    fullMark: 100,
    moduleColor: moduleColorMap[ms.module_id] || '#6366f1',
  }))

  const chartColors = await getChartColors()
  const audioName = `${evaluation.audioprothesiste?.first_name ?? ''} ${evaluation.audioprothesiste?.last_name ?? ''}`

  return (
    <div>
      <Header
        title={`Évaluation - ${audioName}`}
        description={evaluation.job_profile?.name ?? 'Aucun profil métier'}
      />
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Form — 2/3 */}
          <div className="xl:col-span-2">
            {isReadOnly && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
                <Lock className="h-4 w-4 flex-shrink-0" />
                <span>Lecture seule — ce collaborateur ne fait pas partie de votre équipe</span>
              </div>
            )}
            <EvaluationForm
              evaluationId={evaluation.id}
              evaluationStatus={evaluation.status}
              modules={modules ?? []}
              qualifiers={qualifiers ?? []}
              qualifiersByModule={qualifiersByModule}
              initialState={initialState}
              readOnly={isReadOnly}
            />
          </div>

          {/* Radar sidebar — 1/3, sticky */}
          <div className="xl:col-span-1">
            <div className="sticky top-6 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Aperçu radar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {radarData.length > 0 && radarData.some(d => d.actual > 0) ? (
                    <CompetencyRadarChart
                      data={radarData}
                      expectedLabel="Attendu"
                      actualLabel="Niveau actuel"
                      colors={chartColors}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      Enregistrez des scores pour voir le radar
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Enregistrez pour actualiser le graphique
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
