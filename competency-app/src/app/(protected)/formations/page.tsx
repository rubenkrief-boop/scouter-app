import { Header } from '@/components/layout/header'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import {
  getFormationSessions, getFormationAteliers, getFormationInscriptions,
  getFormationStats, getAllProgrammeAtelierMappings, getWorkerFormations,
  getFormationProgrammeSettings, getFormationProgrammeFiles,
  getMyFranchiseTeam,
} from '@/lib/actions/formations'
import { FormationsDashboard } from '@/components/formations/formations-dashboard'
import { WorkerFormationsView } from '@/components/formations/worker-formations-view'
import { FormationSelfRegister } from '@/components/formations/formation-self-register'
import { FranchiseTeamEnroll } from '@/components/formations/franchise-team-enroll'
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

    // Le gerant_franchise voit aussi le bloc "Inscrire mon equipe".
    const isGerant = profile.role === 'gerant_franchise'
    const franchiseTeam = isGerant ? await getMyFranchiseTeam() : []

    // Un salarie franchise (formation_user + statut=franchise) ne peut pas
    // s'auto-inscrire ; on cache donc le composant self-register pour lui.
    const canSelfRegister =
      profile.role !== 'formation_user' || userStatut !== 'Franchise'

    return (
      <>
        <Header
          title="Mes Formations"
          description={isGerant ? 'Gérez les inscriptions de votre équipe' : 'Vos sessions de formation plénière'}
        />
        <div className="p-6 space-y-6">
          {/* Bloc gerant_franchise : inscription de son equipe */}
          {isGerant && (
            <FranchiseTeamEnroll
              team={franchiseTeam}
              sessions={openSessions}
              programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
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

          {/* Pour les salaries franchise sans auto-inscription : info que
              le gerant doit prendre le relais. */}
          {openSessions.length > 0 && !canSelfRegister && !isGerant && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">Inscription gérée par votre gérant</p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                En tant que salarié(e) d&apos;un centre franchisé, l&apos;inscription
                aux formations est effectuée par votre gérant franchisé. Vous
                retrouverez ci-dessous l&apos;historique de vos inscriptions une
                fois qu&apos;elles auront été créées.
              </p>
            </div>
          )}

          <WorkerFormationsView
            inscriptions={myInscriptions}
            ateliers={ateliers}
            progAtelierMappings={progAtelierMappings}
          />
        </div>
      </>
    )
  }

  // Admin/Manager: dashboard complet
  const [sessions, ateliers, inscriptions, stats, progAtelierMappings, programmeSettings, franchiseTeam] = await Promise.all([
    getFormationSessions(),
    getFormationAteliers(),
    getFormationInscriptions(),
    getFormationStats(),
    getAllProgrammeAtelierMappings(),
    getFormationProgrammeSettings(),
    // Un manager (Sacha, Pierre-Ugo) peut aussi avoir des centres franchise
    // affectes via centre_managers -> il voit le bloc "Mon equipe franchise".
    getMyFranchiseTeam(),
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
        {/* Bloc "Mon equipe franchise" si l'admin/manager gere au moins un
            centre franchise via centre_managers (ex: Sacha gere 3 franchises
            en plus de ses succursales). */}
        {franchiseTeam.length > 0 && openSessions.length > 0 && (
          <FranchiseTeamEnroll
            team={franchiseTeam}
            sessions={openSessions}
            programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
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
