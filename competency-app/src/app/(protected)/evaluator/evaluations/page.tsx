import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { EvaluationList } from '@/components/evaluations/evaluation-list'
import { VisitAlertCard } from '@/components/visits/visit-alert-card'
import { getOverdueCenters } from '@/lib/actions/visits'

export default async function EvaluationsPage() {
  const supabase = await createClient()

  const [{ data: evaluations }, overdueCenters] = await Promise.all([
    supabase
      .from('evaluations')
      .select(`
        *,
        evaluator:profiles!evaluator_id(first_name, last_name),
        audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
        job_profile:job_profiles(name)
      `)
      .order('evaluated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    getOverdueCenters(),
  ])

  return (
    <div>
      <Header
        title="Évaluations"
        description="Suivi des évaluations de tous les collaborateurs"
      />
      <div className="p-6 space-y-6">
        <VisitAlertCard overdueCenters={overdueCenters} />
        <EvaluationList evaluations={evaluations ?? []} />
      </div>
    </div>
  )
}
