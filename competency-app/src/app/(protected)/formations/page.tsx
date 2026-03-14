import { Header } from '@/components/layout/header'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import {
  getFormationSessions, getFormationAteliers, getFormationInscriptions,
  getFormationStats, getAllProgrammeAtelierMappings, getWorkerFormations,
  getFormationProgrammeSettings, getFormationProgrammeFiles,
} from '@/lib/actions/formations'
import { FormationsDashboard } from '@/components/formations/formations-dashboard'
import { WorkerFormationsView } from '@/components/formations/worker-formations-view'
import { FormationSelfRegister } from '@/components/formations/formation-self-register'
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

    return (
      <>
        <Header
          title="Mes Formations"
          description="Vos sessions de formation plénière"
        />
        <div className="p-6 space-y-6">
          {/* Self-registration section (only if open sessions exist) */}
          {openSessions.length > 0 && (
            <FormationSelfRegister
              sessions={openSessions}
              programmeSettings={programmeSettings.filter(s => openSessionIds.has(s.session_id))}
              programmeFiles={programmeFiles.filter(f => openSessionIds.has(f.session_id))}
              myInscriptions={myInscriptions}
            />
          )}

          <WorkerFormationsView
            inscriptions={myInscriptions}
            sessions={sessions}
            ateliers={ateliers}
            progAtelierMappings={progAtelierMappings}
            workerName={`${profile.first_name} ${profile.last_name}`}
          />
        </div>
      </>
    )
  }

  // Admin/Manager: dashboard complet
  const [sessions, ateliers, inscriptions, stats, progAtelierMappings] = await Promise.all([
    getFormationSessions(),
    getFormationAteliers(),
    getFormationInscriptions(),
    getFormationStats(),
    getAllProgrammeAtelierMappings(),
  ])

  return (
    <>
      <Header
        title="Formations Plénières"
        description="Suivi des sessions de formation, ateliers et participants"
      />
      <div className="p-6">
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
