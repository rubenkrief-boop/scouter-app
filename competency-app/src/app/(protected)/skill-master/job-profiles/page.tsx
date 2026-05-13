import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { JobProfileList } from '@/components/modules/job-profile-list'

export default async function JobProfilesPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')
  if (!['super_admin', 'skill_master'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('job_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title="Profils métier"
        description="Définir les niveaux de compétences attendus par profil"
      />
      <div className="p-6">
        <JobProfileList profiles={profiles ?? []} />
      </div>
    </div>
  )
}
