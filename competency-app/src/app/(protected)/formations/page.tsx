import { Header } from '@/components/layout/header'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import {
  getFormationSessions, getFormationAteliers, getFormationInscriptions,
  getFormationStats, getAllProgrammeAtelierMappings, getWorkerFormations,
  getFormationProgrammeSettings, getFormationProgrammeFiles,
  getMyFranchiseTeam, getMyWorkerTeam, getMyTeamInscriptions,
} from '@/lib/actions/formations'
import { FormationsDashboard } from '@/components/formations/formations-dashboard'
import { WorkerFormationsView } from '@/components/formations/worker-formations-view'
import { FormationSelfRegister } from '@/components/formations/formation-self-register'
import { TeamDashboard } from '@/components/formations/team-dashboard'
import { redirect } from 'next/navigation'

export default async function FormationsPage() {
  const { profile } = await getAuthProfile()
  if (!profile) redirect('/auth/login')

  const isAdmin = ['super_admin', 'skill_master', 'manager'].includes(profile.role)

  // Worker: vue personnelle uniquement
  if (!isAdmin) {
    const [myInscriptions, sessions, ateliers, progAtelierMappings, programmeSettings, programmeFiles] = await Promise.all([
      getWorkerFormations(profile.id),
      getFormationSessions(),
      getFormationAteliers(),
      getAllProgrammeAtelierMappings(),
      getFormationProgrammeSettings(),
      getFormationProgrammeFiles(),
    ])

    // Sessions with open registration
    const openSessions = sessions.filter(s => s.is_active && s.registration_open)
    const openSessionIds = new Set(openSessions.map(s => s.id))

    // Determine user statut depuis la colonne `statut` (decouplee du role
    // depuis migration 00028). Fallback role-base si la colonne manque.
    const profileStatut = (profile as typeof profile & { statut?: string }).statut
    const userStatut =
      profileStatut === 'franchise' ? 'Franchise' as const
      : profileStatut === 'succursale' ? 'Succursale' as const
      : profile.role === 'formation_user' ? 'Franchise' as const : 'Succursale' as const

    // Le gerant_franchise voit le dashboard "Mon equipe" (stats + tableau
    // d'inscriptions + bouton d'inscription en lot).
    const isGerant = profile.role === 'gerant_franchise'
    const [franchiseTeam, teamInscriptions] = isGerant
      ? await Promise.all([getMyFranchiseTeam(), getMyTeamInscriptions()])
      : [[], []]

    // Les salaries (worker succursale ET formation_user franchise) ne peuvent
    // pas s'auto-inscrire : c'est le manager/gerant qui inscrit son equipe en
    // lot. On cache donc le composant self-register pour eux.
    const canSelfRegister =
      profile.role !== 'worker' &&
      !(profile.role === 'formation_user' && userStatut === 'Franchise')

    return (
      <>
        <Header
          title="Mes Formations"
          description={isGerant ? 'Gérez les inscriptions de votre équipe' : 'Vos sessions de formation plénière'}
        />
        <div className="p-6 space-y-6">
          {/* Bloc gerant_franchise : dashboard equipe (stats + tableau +
              dialog d'inscription). Remplace l'ancien FranchiseTeamEnroll
              minimaliste. */}
          {isGerant && (
            <TeamDashboard
              team={franchiseTeam}
              inscriptions={teamInscriptions}
              sessions={openSessions}
              programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
              ateliers={ateliers}
              progAtelierMappings={progAtelierMappings}
              mode="franchise"
            />
          )}

          {/* Self-registration section (only if open sessions exist AND user is
              allowed to self-register — les salaries franchise sont exclus) */}
          {openSessions.length > 0 && canSelfRegister && (
            <FormationSelfRegister
              sessions={openSessions}
              programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
              programmeFiles={programmeFiles.filter(f => openSessionIds.has(f.session_id))}
              myInscriptions={myInscriptions}
              userStatut={userStatut}
            />
          )}

          {/* Pour les salaries sans auto-inscription : info que le manager
              ou le gerant doit prendre le relais. */}
          {openSessions.length > 0 && !canSelfRegister && !isGerant && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Inscription gérée par votre {userStatut === 'Franchise' ? 'gérant' : 'manager'}
              </p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                L&apos;inscription aux formations est effectuée par votre{' '}
                {userStatut === 'Franchise' ? 'gérant franchisé' : 'manager succursale'}.
                Vous retrouverez ci-dessous l&apos;historique de vos inscriptions une
                fois qu&apos;elles auront été créées.
              </p>
            </div>
          )}

          <WorkerFormationsView
            inscriptions={myInscriptions}
            ateliers={ateliers}
            progAtelierMappings={progAtelierMappings}
            programmeSettings={programmeSettings}
          />
        </div>
      </>
    )
  }

  // Admin/Manager: dashboard complet
  const [sessions, ateliers, inscriptions, stats, progAtelierMappings, programmeSettings, franchiseTeam, workerTeam, teamInscriptions] = await Promise.all([
    getFormationSessions(),
    getFormationAteliers(),
    getFormationInscriptions(),
    getFormationStats(),
    getAllProgrammeAtelierMappings(),
    getFormationProgrammeSettings(),
    // Un manager (Sacha, Pierre-Ugo) peut aussi avoir des centres franchise
    // affectes via centre_managers -> il voit le bloc "Mon equipe franchise".
    getMyFranchiseTeam(),
    // Les workers succursale des centres geres : le manager les inscrit
    // (ils ne peuvent pas s'auto-inscrire).
    getMyWorkerTeam(),
    // Inscriptions des membres de l'equipe pour le dashboard team.
    getMyTeamInscriptions(),
  ])

  const openSessions = sessions.filter(s => s.is_active && s.registration_open)
  const openSessionIds = new Set(openSessions.map(s => s.id))

  return (
    <>
      <Header
        title="Formations Plénières"
        description="Suivi des sessions de formation, ateliers et participants"
      />
      <div className="p-6 space-y-6">
        {/* Dashboard equipe succursale (workers des centres geres) */}
        {workerTeam.length > 0 && (
          <TeamDashboard
            team={workerTeam}
            inscriptions={teamInscriptions.filter(i => i.statut === 'Succursale')}
            sessions={openSessions}
            programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
            ateliers={ateliers}
            progAtelierMappings={progAtelierMappings}
            mode="succursale"
          />
        )}

        {/* Dashboard equipe franchise (ex: Sacha gere 3 franchises) */}
        {franchiseTeam.length > 0 && (
          <TeamDashboard
            team={franchiseTeam}
            inscriptions={teamInscriptions.filter(i => i.statut === 'Franchise')}
            sessions={openSessions}
            programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
            ateliers={ateliers}
            progAtelierMappings={progAtelierMappings}
            mode="franchise"
          />
        )}

        <FormationsDashboard
          sessions={sessions}
          ateliers={ateliers}
          inscriptions={inscriptions}
          stats={stats}
          progAtelierMappings={progAtelierMappings}
          isAdmin={isAdmin}
        />
      </div>
    </>
  )
}
