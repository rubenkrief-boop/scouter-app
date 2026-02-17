import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { EvaluationList } from '@/components/evaluations/evaluation-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function EvaluationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluator_id(first_name, last_name),
      audioprothesiste:profiles!audioprothesiste_id(first_name, last_name),
      job_profile:job_profiles(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <Header
        title="Évaluations"
        description="Gérer les évaluations"
      >
        <Link href="/evaluator/evaluations/new">
          <Button className="bg-rose-600 hover:bg-rose-700">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle évaluation
          </Button>
        </Link>
      </Header>
      <div className="p-6">
        <EvaluationList evaluations={evaluations ?? []} />
      </div>
    </div>
  )
}
