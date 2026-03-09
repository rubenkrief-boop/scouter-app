import { Header } from '@/components/layout/header'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getFormationSessions, getFormationAteliers, getFormationInscriptions } from '@/lib/actions/formations'
import { FormationsAdmin } from '@/components/formations/formations-admin'
import { redirect } from 'next/navigation'

export default async function FormationsAdminPage() {
  const { profile } = await getAuthProfile()
  if (!profile) redirect('/auth/login')

  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!allowedRoles.includes(profile.role)) {
    redirect('/formations')
  }

  const [sessions, ateliers, inscriptions] = await Promise.all([
    getFormationSessions(),
    getFormationAteliers(),
    getFormationInscriptions(),
  ])

  return (
    <>
      <Header
        title="Admin Formations"
        description="Gestion des sessions, ateliers et inscriptions"
      />
      <div className="p-6">
        <FormationsAdmin
          sessions={sessions}
          ateliers={ateliers}
          inscriptions={inscriptions}
          isSuperAdmin={profile.role === 'super_admin'}
        />
      </div>
    </>
  )
}
