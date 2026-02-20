import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { EvaluationForm } from '@/components/evaluations/evaluation-form'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'

export default async function EvaluationDetailPage({
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

  const radarData: RadarDataPoint[] = (moduleScores ?? []).map((ms: any) => ({
    module: `${ms.module_code} - ${ms.module_name}`,
    actual: parseFloat(ms.completion_pct) || 0,
    expected: expectedScores[ms.module_id] ?? 70,
    fullMark: 100,
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
            <EvaluationForm
              evaluationId={evaluation.id}
              evaluationStatus={evaluation.status}
              modules={modules ?? []}
              qualifiers={qualifiers ?? []}
              initialState={initialState}
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
