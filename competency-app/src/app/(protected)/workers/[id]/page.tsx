import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Mail, Briefcase, Calendar, ClipboardCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { ModuleProgressList } from '@/components/dashboard/module-progress-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RadarDataPoint } from '@/lib/types'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { ScouterTrigger } from '@/components/animations/scouter-trigger'
import { StartEvaluationButton } from '@/components/evaluations/start-evaluation-button'
import { EvaluationHistory } from '@/components/evaluations/evaluation-history'
import { AvatarUpload } from '@/components/workers/avatar-upload'

export default async function WorkerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile: currentProfile } = await getAuthProfile()

  if (!user || !currentProfile) redirect('/auth/login')

  // Only managers, skill_masters, and super_admins can view workers
  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!allowedRoles.includes(currentProfile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get worker profile
  const { data: worker } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, job_title, job_profile_id, role, created_at, avatar_url,
      location:locations(name),
      manager:profiles!manager_id(first_name, last_name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!worker) notFound()

  const loc = worker.location as any
  const mgr = worker.manager as any
  const workerJobProfileId: string | null = (worker as any).job_profile_id ?? null

  // Récupérer le nom du profil métier séparément (évite un join FK qui peut échouer si le cache PostgREST n'est pas à jour)
  let workerJobProfileName: string | null = null
  if (workerJobProfileId) {
    const { data: jp } = await supabase
      .from('job_profiles')
      .select('name')
      .eq('id', workerJobProfileId)
      .single()
    workerJobProfileName = jp?.name ?? null
  }

  // Chercher d'abord l'évaluation continue, sinon la dernière complétée
  let latestEval: any = null

  // 1. Evaluation continue (nouveau modèle)
  const { data: continuousEval } = await supabase
    .from('evaluations')
    .select(`
      *,
      job_profile:job_profiles(id, name),
      evaluator:profiles!evaluator_id(first_name, last_name)
    `)
    .eq('audioprothesiste_id', id)
    .eq('is_continuous', true)
    .limit(1)
    .single()

  if (continuousEval) {
    latestEval = continuousEval
  } else {
    // 2. Fallback : dernière évaluation complétée (ancien modèle)
    const { data: completedEval } = await supabase
      .from('evaluations')
      .select(`
        *,
        job_profile:job_profiles(id, name),
        evaluator:profiles!evaluator_id(first_name, last_name)
      `)
      .eq('audioprothesiste_id', id)
      .eq('status', 'completed')
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .single()

    latestEval = completedEval
  }

  let radarData: RadarDataPoint[] = []
  // Nom du profil métier : priorité au profil du collaborateur, fallback sur l'évaluation
  const jobProfileName: string | null = workerJobProfileName ?? null

  if (latestEval) {

    const { data: moduleScores } = await supabase
      .rpc('get_module_scores', { p_evaluation_id: latestEval.id })

    let expectedScores: Record<string, number> = {}
    // Utiliser le job_profile_id du profil collaborateur (source de verite)
    const effectiveJobProfileId = workerJobProfileId ?? latestEval.job_profile_id
    if (effectiveJobProfileId) {
      const { data: jpComps } = await supabase
        .from('job_profile_competencies')
        .select('*')
        .eq('job_profile_id', effectiveJobProfileId)

      jpComps?.forEach((jpc) => {
        expectedScores[jpc.module_id] = jpc.expected_score
      })
    }

    radarData = (moduleScores ?? []).map((ms: any) => ({
      module: `${ms.module_code} - ${ms.module_name}`,
      actual: parseFloat(ms.completion_pct) || 0,
      expected: expectedScores[ms.module_id] ?? 0,
      fullMark: 100,
    }))
  }

  // Stats
  const { count: evalCount } = await supabase
    .from('evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('audioprothesiste_id', id)

  const avgScore = radarData.length > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / radarData.length)
    : 0
  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected && d.expected > 0).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length
  const shouldTriggerScouter = (modulesWithExpected > 0 && modulesAboveExpected === modulesWithExpected) || avgScore >= 90

  const chartColors = await getChartColors()
  const fullName = `${worker.first_name} ${worker.last_name}`

  return (
    <div>
      <ScouterTrigger
        score={avgScore}
        triggered={shouldTriggerScouter}
        storageKey={`scouter-worker-${id}`}
      />
      <Header
        title={fullName}
        description={worker.job_title ?? 'Collaborateur'}
      />
      <div className="p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/workers"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux collaborateurs
        </Link>

        {/* Profile header card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <AvatarUpload
                  userId={id}
                  firstName={worker.first_name}
                  lastName={worker.last_name}
                  currentAvatarUrl={(worker as any).avatar_url}
                  size="lg"
                />
                <div>
                  <h2 className="text-xl font-bold">{fullName}</h2>
                  <p className="text-white/80">{worker.job_title ?? 'Poste non défini'}</p>
                  {jobProfileName && (
                    <Badge className="mt-1.5 bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {jobProfileName}
                    </Badge>
                  )}
                </div>
              </div>
              {workerJobProfileId ? (
                <StartEvaluationButton
                  workerId={id}
                  jobProfileId={workerJobProfileId}
                  variant="ghost"
                  size="sm"
                  className="text-xs bg-white/20 hover:bg-white/30 text-white"
                />
              ) : (
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  Aucun profil métier attribué
                </Badge>
              )}
            </div>

            {/* Info row */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {worker.email}
              </span>
              {loc?.name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {loc.name}
                </span>
              )}
              {mgr && (
                <span className="flex items-center gap-1.5">
                  Manager : {mgr.first_name} {mgr.last_name}
                </span>
              )}
              {worker.created_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Depuis {new Date(worker.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Stats row — uniquement si profil métier attribué */}
          {workerJobProfileId && (
            <CardContent className="p-0">
              <div className="grid grid-cols-3 divide-x">
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-600">{evalCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Évaluations</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-indigo-600">{avgScore}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Score moyen</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {modulesAboveExpected}/{modulesWithExpected}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Modules validés</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Contenu principal : dépend du profil métier */}
        {!workerJobProfileId ? (
          /* Pas de profil métier → message d'avertissement, pas d'évaluation possible */
          <Card>
            <CardContent className="py-16 text-center">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-amber-400" />
              <p className="text-lg font-medium text-foreground">Aucun profil métier attribué</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Pour pouvoir évaluer ce collaborateur, vous devez d&apos;abord lui attribuer un profil métier
                depuis la page de gestion des utilisateurs.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Les modules d&apos;évaluation sont définis dans chaque profil métier.
              </p>
            </CardContent>
          </Card>
        ) : radarData.length > 0 ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Bilan de compétences</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Comparaison entre le niveau actuel et le niveau attendu pour le profil
                      {jobProfileName ? ` « ${jobProfileName} »` : ' métier'}
                    </p>
                  </div>
                  {latestEval?.evaluated_at && (
                    <span className="text-xs text-muted-foreground">
                      Dernière évaluation : {new Date(latestEval.evaluated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CompetencyRadarChart
                  data={radarData}
                  expectedLabel="Attendu"
                  actualLabel="Niveau actuel"
                  colors={chartColors}
                  fullSize
                />
                {/* Code legend */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                    {radarData.map((d, i) => {
                      const parts = d.module.split(' - ')
                      const code = parts[0]?.trim() || ''
                      const name = parts[1]?.trim() || d.module
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400 w-6">{code}</span>
                          <span className="truncate">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detail by module */}
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
            {/* Historique des évaluations */}
            {latestEval && (
              <EvaluationHistory evaluationId={latestEval.id} />
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium text-muted-foreground">Aucune évaluation</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ce collaborateur n&apos;a pas encore été évalué.
              </p>
              <div className="mt-4">
                <StartEvaluationButton
                  workerId={id}
                  jobProfileId={workerJobProfileId}
                  className="bg-indigo-600 hover:bg-indigo-700"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
