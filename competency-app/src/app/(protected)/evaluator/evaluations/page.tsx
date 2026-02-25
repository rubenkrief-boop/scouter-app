import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { EvaluationList } from '@/components/evaluations/evaluation-list'

export default async function EvaluationsPage() {
  const supabase = await createClient()

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluator_id(first_name, last_name),
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
      job_profile:job_profiles(name)
    `)
    .order('evaluated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title="Évaluations"
        description="Suivi des évaluations de tous les collaborateurs"
      />
      <div className="p-6">
        <EvaluationList evaluations={evaluations ?? []} />
      </div>
    </div>
  )
}
