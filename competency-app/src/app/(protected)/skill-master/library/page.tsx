import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { CompetencyLibrary } from '@/components/modules/competency-library'

export default async function LibraryPage() {
  const supabase = await createClient()

  const { data: modules } = await supabase
    .from('modules')
    .select('*, competencies(count)')
    .order('sort_order')

  return (
    <div>
      <Header
        title="Compétences"
        description="Bibliothèque des compétences par module"
      />
      <div className="p-6">
        <CompetencyLibrary modules={modules ?? []} />
      </div>
    </div>
  )
}
