import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { NewEvaluationForm } from '@/components/evaluations/new-evaluation-form'

export default async function NewEvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string }>
}) {
  const { worker: preselectedWorkerId } = await searchParams
  const supabase = await createClient()
  const { user, profile } = await getAuthProfile()

  let workersQuery = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'worker')
    .eq('is_active', true)
    .order('last_name')

  // Manager can only create evaluations for their team
  if (profile?.role === 'manager' && user) {
    workersQuery = workersQuery.eq('manager_id', user.id)
  }

  const { data: workers } = await workersQuery

  const { data: jobProfiles } = await supabase
    .from('job_profiles')
    .select('*')
    .eq('is_active', true)

  return (
    <div>
      <Header
        title="Nouvelle évaluation"
        description="Créer une évaluation pour un collaborateur"
      />
      <div className="p-6">
        <NewEvaluationForm
          workers={workers ?? []}
          jobProfiles={jobProfiles ?? []}
          preselectedWorkerId={preselectedWorkerId}
        />
      </div>
    </div>
  )
}
