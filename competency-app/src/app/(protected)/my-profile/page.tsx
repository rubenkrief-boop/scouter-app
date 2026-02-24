import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { ModuleProgressList } from '@/components/dashboard/module-progress-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { ScouterTrigger } from '@/components/animations/scouter-trigger'

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

  const avgScore = radarData.length > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / radarData.length)
    : 0

  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length
  const shouldTriggerScouter = (modulesWithExpected > 0 && modulesAboveExpected === modulesWithExpected) || avgScore >= 90
  const jobProfileName = (latestEval?.job_profile as any)?.name

  return (
    <div>
      <ScouterTrigger
        score={avgScore}
        triggered={shouldTriggerScouter}
        storageKey="scouter-my-profile"
      />
      <Header
        title="Mon profil de competences"
        description="Visualisez vos evaluations et votre progression"
      />
      <div className="p-6 space-y-6">
        {/* Profile header card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile?.first_name} {profile?.last_name}</h2>
                <p className="text-white/80">{profile?.job_title ?? 'Poste non defini'}</p>
                {jobProfileName && (
                  <Badge className="mt-1 bg-white/20 text-white border-white/30 hover:bg-white/30">
                    Profil : {jobProfileName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x">
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{evalCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Evaluations</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{avgScore}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Score moyen</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {modulesAboveExpected}/{radarData.length}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Modules valides</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar + Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Bilan de competences</CardTitle>
              <p className="text-xs text-muted-foreground">
                Comparaison entre votre niveau actuel et le niveau attendu pour votre profil metier
              </p>
            </CardHeader>
            <CardContent>
              {radarData.length > 0 ? (
                <CompetencyRadarChart data={radarData} colors={chartColors} />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-2">
                  <p className="text-lg font-medium">Pas encore d&apos;evaluation</p>
                  <p className="text-sm">Contactez votre manager pour planifier votre premiere evaluation.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Detail par module</CardTitle>
              <p className="text-xs text-muted-foreground">
                Trie par ecart avec l&apos;attendu
              </p>
            </CardHeader>
            <CardContent className="max-h-[620px] overflow-y-auto">
              <ModuleProgressList data={radarData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
