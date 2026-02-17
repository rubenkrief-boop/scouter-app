import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { ModuleProgressList } from '@/components/dashboard/module-progress-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'

export default async function MyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Get latest evaluation (any status — continuous evaluation)
  const { data: latestEval } = await supabase
    .from('evaluations')
    .select(`
      *,
      job_profile:job_profiles(name)
    `)
    .eq('audioprothesiste_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  let radarData: RadarDataPoint[] = []

  if (latestEval) {
    // Get module scores
    const { data: moduleScores } = await supabase
      .rpc('get_module_scores', { p_evaluation_id: latestEval.id })

    // Get expected scores
    let expectedScores: Record<string, number> = {}
    if (latestEval.job_profile_id) {
      const { data: jpComps } = await supabase
        .from('job_profile_competencies')
        .select('*')
        .eq('job_profile_id', latestEval.job_profile_id)

      jpComps?.forEach((jpc) => {
        expectedScores[jpc.module_id] = jpc.expected_score
      })
    }

    radarData = (moduleScores ?? []).map((ms: any) => ({
      module: `${ms.module_code} - ${ms.module_name}`,
      actual: parseFloat(ms.completion_pct) || 0,
      expected: expectedScores[ms.module_id] ?? 70,
      fullMark: 100,
    }))
  }

  const chartColors = await getChartColors()

  // Get all evaluations count
  const { count: evalCount } = await supabase
    .from('evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('audioprothesiste_id', user.id)

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <Header
        title="Mon profil de compétences"
        description="Visualisez vos évaluations et votre progression"
      />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-rose-600">{evalCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">Évaluations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {radarData.length > 0 ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / radarData.length) : 0}%
              </p>
              <p className="text-sm text-muted-foreground">Score moyen</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {profile?.job_title ?? 'Non défini'}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">Emploi</p>
            </CardContent>
          </Card>
        </div>

        {/* Radar + Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Matching compétences</CardTitle>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <CompetencyRadarChart data={radarData} colors={chartColors} />
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  Aucune évaluation disponible. Contactez votre manager.
                </div>
              )}
            </CardContent>
          </Card>

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
