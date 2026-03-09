import { Header } from '@/components/layout/header'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getFormationSessions, getFormationAteliers, getFormationInscriptions, getFormationStats } from '@/lib/actions/formations'
import { FormationsDashboard } from '@/components/formations/formations-dashboard'
import { redirect } from 'next/navigation'

export default async function FormationsPage() {
  const { profile } = await getAuthProfile()
  if (!profile) redirect('/auth/login')

  const [sessions, ateliers, inscriptions, stats] = await Promise.all([
    getFormationSessions(),
    getFormationAteliers(),
    getFormationInscriptions(),
    getFormationStats(),
  ])

  const isAdmin = ['super_admin', 'skill_master', 'manager'].includes(profile.role)

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
          isAdmin={isAdmin}
        />
      </div>
    </>
  )
}
