import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { QualifierEditor } from '@/components/qualifiers/qualifier-editor'

export default async function QualifierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')
  if (!['super_admin', 'skill_master'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: qualifier } = await supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .eq('id', id)
    .single()

  if (!qualifier) notFound()

  return (
    <div>
      <Header
        title={qualifier.name}
        description="Modifier le qualifier et ses options"
      />
      <div className="p-6">
        <QualifierEditor qualifier={qualifier} />
      </div>
    </div>
  )
}
