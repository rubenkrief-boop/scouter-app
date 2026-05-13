import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { QualifierList } from '@/components/qualifiers/qualifier-list'

export default async function QualifiersPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')
  if (!['super_admin', 'skill_master'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const { data: qualifiers } = await supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .order('sort_order')

  return (
    <div>
      <Header
        title="Qualifiers"
        description="Créer et modifier les qualifiers d'évaluation"
      />
      <div className="p-6">
        <QualifierList qualifiers={qualifiers ?? []} />
      </div>
    </div>
  )
}
