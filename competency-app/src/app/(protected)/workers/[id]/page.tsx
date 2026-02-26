import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Mail, Briefcase, Calendar } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { AvatarUpload } from '@/components/workers/avatar-upload'
import { AssignJobProfile } from '@/components/workers/assign-job-profile'
import { WorkerJobProfileCard } from '@/components/workers/worker-job-profile-card'

export default async function WorkerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile: currentProfile } = await getAuthProfile()

  if (!user || !currentProfile) redirect('/auth/login')

  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!allowedRoles.includes(currentProfile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get worker profile
  const { data: worker } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, job_title, role, created_at, avatar_url,
      location:locations(name),
      manager:profiles!manager_id(first_name, last_name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (!worker) notFound()

  const loc = worker.location as any
  const mgr = worker.manager as any
  const fullName = `${worker.first_name} ${worker.last_name}`

  // Fetch assigned job profiles (N-N via audioprothesiste_assignments)
  const { data: assignments } = await supabase
    .from('audioprothesiste_assignments')
    .select('job_profile_id, job_profile:job_profiles(id, name)')
    .eq('audioprothesiste_id', id)

  const assignedProfiles = (assignments ?? []).map(a => ({
    id: (a.job_profile as any)?.id as string,
    name: (a.job_profile as any)?.name as string,
  })).filter(p => p.id)

  const assignedProfileIds = assignedProfiles.map(p => p.id)

  // Fetch all available job profiles (for the add selector)
  const { data: allJobProfiles } = await supabase
    .from('job_profiles')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Fetch continuous evaluations for this worker (one per profile)
  const { data: continuousEvals } = await supabase
    .from('evaluations')
    .select('id, job_profile_id')
    .eq('audioprothesiste_id', id)
    .eq('is_continuous', true)

  // Map profile_id -> evaluation_id
  const evalByProfile = new Map<string, string>()
  for (const ev of (continuousEvals ?? [])) {
    if (ev.job_profile_id) {
      evalByProfile.set(ev.job_profile_id, ev.id)
    }
  }

  // Fetch batch module scores for all evaluations
  const evalIds = Array.from(evalByProfile.values())
  let batchScores: any[] = []
  if (evalIds.length > 0) {
    const { data } = await supabase.rpc('get_batch_module_scores', { p_evaluation_ids: evalIds })
    batchScores = data ?? []
  }

  // Group scores by evaluation_id
  const scoresByEval = new Map<string, any[]>()
  for (const score of batchScores) {
    const list = scoresByEval.get(score.evaluation_id) ?? []
    list.push(score)
    scoresByEval.set(score.evaluation_id, list)
  }

  // Fetch expected scores for all assigned profiles
  const { data: allExpectedScores } = await supabase
    .from('job_profile_competencies')
    .select('job_profile_id, module_id, expected_score')
    .in('job_profile_id', assignedProfileIds.length > 0 ? assignedProfileIds : ['__none__'])

  // Group expected scores by profile_id
  const expectedByProfile = new Map<string, { module_id: string; expected_score: number }[]>()
  for (const es of (allExpectedScores ?? [])) {
    const list = expectedByProfile.get(es.job_profile_id) ?? []
    list.push({ module_id: es.module_id, expected_score: es.expected_score })
    expectedByProfile.set(es.job_profile_id, list)
  }

  return (
    <div>
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
            <div className="flex items-start gap-4">
              <AvatarUpload
                userId={id}
                firstName={worker.first_name}
                lastName={worker.last_name}
                currentAvatarUrl={(worker as any).avatar_url}
                size="lg"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold">{fullName}</h2>
                {assignedProfiles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {assignedProfiles.map(p => (
                      <Badge key={p.id} className="bg-white/20 text-white border-white/30 text-xs">
                        <Briefcase className="h-3 w-3 mr-1" />
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/70 text-sm mt-1">Aucun profil métier attribué</p>
                )}
              </div>
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
        </Card>

        {/* Section : Emplois actuels */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Emplois actuels</h3>

          {assignedProfiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedProfiles.map(profile => {
                const evalId = evalByProfile.get(profile.id)
                const allModuleScores = evalId ? (scoresByEval.get(evalId) ?? []) : []
                const expectedScores = expectedByProfile.get(profile.id) ?? []

                // Filter module scores to only include modules from this job profile
                const profileModuleIds = new Set(expectedScores.map(es => es.module_id))
                const moduleScores = profileModuleIds.size > 0
                  ? allModuleScores.filter((ms: any) => profileModuleIds.has(ms.module_id))
                  : allModuleScores

                return (
                  <WorkerJobProfileCard
                    key={profile.id}
                    workerId={id}
                    profileId={profile.id}
                    profileName={profile.name}
                    moduleScores={moduleScores}
                    expectedScores={expectedScores}
                    hasEvaluation={!!evalId}
                    hasModulesConfigured={expectedScores.length > 0}
                  />
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-amber-400" />
                <p className="text-lg font-medium text-foreground">Aucun profil métier attribué</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-md mx-auto">
                  Attribuez un profil métier à ce collaborateur pour pouvoir l&apos;évaluer.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Ajouter un profil métier */}
          <div className="mt-4">
            <AssignJobProfile
              workerId={id}
              jobProfiles={allJobProfiles ?? []}
              assignedProfileIds={assignedProfileIds}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
