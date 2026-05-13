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
import { WorkerFormationsCard } from '@/components/formations/worker-formations-card'
import { RgpdActions } from '@/components/profile/rgpd-actions'
import { getWorkerFormations } from '@/lib/actions/formations'
import { GraduationCap, MapPin, Briefcase } from 'lucide-react'
import { relLocationName, relJobProfile } from '@/lib/types/relations'

export default async function MyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, location:locations(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  // Fetch worker formations (needed for both roles)
  const workerFormations = await getWorkerFormations(user.id)

  // ============================================
  // FORMATION_USER: simplified profile (no evaluations)
  // ============================================
  if (profile.role === 'formation_user') {
    return (
      <div>
        <Header
          title="Mon profil"
          description="Vos informations et vos formations"
        />
        <div className="p-6 space-y-6">
          {/* Simplified profile card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
                  {profile.first_name?.[0]}{profile.last_name?.[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{profile.first_name} {profile.last_name}</h2>
                  {profile.job_title && (
                    <p className="text-white/80 flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      {profile.job_title}
                    </p>
                  )}
                  {relLocationName(profile.location)?.name && (
                    <p className="text-white/70 text-sm flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {relLocationName(profile.location)?.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4 text-blue-500" />
                <span>
                  {workerFormations.length > 0
                    ? `${workerFormations.length} session${workerFormations.length > 1 ? 's' : ''} de formation`
                    : 'Aucune formation enregistrée'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Formations card */}
          <WorkerFormationsCard formations={workerFormations} />

          {/* RGPD actions — export + delete */}
          <RgpdActions userEmail={user.email ?? ''} />
        </div>
      </div>
    )
  }

  // ============================================
  // WORKER: full profile with evaluations
  // ============================================

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
    const expectedScores: Record<string, number> = {}
    if (latestEval.job_profile_id) {
      const { data: jpComps } = await supabase
        .from('job_profile_competencies')
        .select('*')
        .eq('job_profile_id', latestEval.job_profile_id)

      jpComps?.forEach((jpc) => {
        expectedScores[jpc.module_id] = jpc.expected_score
      })
    }

    radarData = (moduleScores ?? []).map((ms: { module_id: string; module_code: string; module_name: string; completion_pct: string | number }) => ({
      module: `${ms.module_code} - ${ms.module_name}`,
      actual: parseFloat(String(ms.completion_pct)) || 0,
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

  const avgScore = radarData.length > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / radarData.length)
    : 0

  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length
  const shouldTriggerScouter = (modulesWithExpected > 0 && modulesAboveExpected === modulesWithExpected) || avgScore >= 90
  const jobProfileName = latestEval ? relJobProfile(latestEval.job_profile)?.name : undefined

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
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.first_name} {profile.last_name}</h2>
                <p className="text-white/80">{profile.job_title ?? 'Poste non defini'}</p>
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

        {/* Section : Formations plénières */}
        <WorkerFormationsCard formations={workerFormations} />

        {/* RGPD actions — export + delete */}
        <RgpdActions userEmail={user.email ?? ''} />
      </div>
    </div>
  )
}
