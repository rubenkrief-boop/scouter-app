import { Header } from '@/components/layout/header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listCentreManagers } from '@/lib/actions/centre-managers'
import { CentreManagersAdmin } from '@/components/admin/centre-managers-admin'

export default async function CentreManagersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const [rows, locationsRes, managersRes] = await Promise.all([
    listCentreManagers(),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .in('role', ['manager', 'gerant_franchise', 'super_admin'])
      .eq('is_active', true)
      .order('first_name'),
  ])

  return (
    <div>
      <Header
        title="Affectations centres ↔ gérants"
        description="Plusieurs centres par gérant et plusieurs gérants par centre (N-à-N)."
      />
      <div className="p-6">
        <CentreManagersAdmin
          rows={rows}
          locations={locationsRes.data ?? []}
          managers={managersRes.data ?? []}
        />
      </div>
    </div>
  )
}
