import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { JobProfileEditor } from '@/components/modules/job-profile-editor'

export default async function JobProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: jobProfile } = await supabase
    .from('job_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!jobProfile) notFound()

  // Fetch top-level modules
  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  // Fetch all competencies for active modules
  const { data: competencies } = await supabase
    .from('competencies')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch existing module-level expected scores
  const { data: expectedScores } = await supabase
    .from('job_profile_competencies')
    .select('*')
    .eq('job_profile_id', id)

  // Fetch existing per-competency settings (weight + expected_score)
  const { data: competencySettings } = await supabase
    .from('job_profile_competency_settings')
    .select('*')
    .eq('job_profile_id', id)

  // Fetch all active qualifiers
  const { data: qualifiers } = await supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch qualifiers already linked to this job profile
  const { data: linkedQualifiers } = await supabase
    .from('job_profile_qualifiers')
    .select('*')
    .eq('job_profile_id', id)

  return (
    <div>
      <Header
        title={jobProfile.name}
        description="Définir les niveaux de compétences attendus, la pondération et les qualifiers"
      />
      <div className="p-6">
        <JobProfileEditor
          jobProfile={jobProfile}
          modules={modules ?? []}
          competencies={competencies ?? []}
          expectedScores={expectedScores ?? []}
          competencySettings={competencySettings ?? []}
          qualifiers={qualifiers ?? []}
          linkedQualifierIds={(linkedQualifiers ?? []).map(lq => lq.qualifier_id)}
        />
      </div>
    </div>
  )
}
