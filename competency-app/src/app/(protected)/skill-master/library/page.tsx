import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { CompetencyLibrary } from '@/components/modules/competency-library'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default async function LibraryPage() {
  const supabase = await createClient()

  const { data: modules } = await supabase
    .from('modules')
    .select('*, competencies(count)')
    .order('sort_order')

  return (
    <div>
      <Header
        title="Competences"
        description="Bibliotheque des competences par module"
      />
      <div className="p-6 space-y-4">
        {/* Info banner with link to job profiles */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700">
            Pour definir le <strong>score attendu</strong> par competence, rendez-vous dans
          </span>
          <Link
            href="/skill-master/job-profiles"
            className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
          >
            Profils metier
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <CompetencyLibrary modules={modules ?? []} />
      </div>
    </div>
  )
}
