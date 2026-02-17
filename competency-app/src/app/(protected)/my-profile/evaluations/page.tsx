import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { EvaluationList } from '@/components/evaluations/evaluation-list'

export default async function MyEvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

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
