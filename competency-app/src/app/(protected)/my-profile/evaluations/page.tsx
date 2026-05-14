import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { EvaluationList } from '@/components/evaluations/evaluation-list'
import { getAuthProfile } from '@/lib/supabase/auth-cache'

export default async function MyEvaluationsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')

  // formation_user et gerant_franchise n'ont pas d'evaluations — redirect
  if (profile.role === 'formation_user' || profile.role === 'gerant_franchise') {
    redirect('/formations')
  }

  const supabase = await createClient()

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluator_id(first_name, last_name),
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
      job_profile:job_profiles(name)
    `)
    .eq('audioprothesiste_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title="Mes évaluations"
        description="Historique de vos évaluations de compétences"
      />
      <div className="p-6">
        <EvaluationList evaluations={evaluations ?? []} />
      </div>
    </div>
  )
}
