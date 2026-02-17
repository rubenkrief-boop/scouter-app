import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { UserManagement } from '@/components/users/user-management'

export default async function UsersPage() {
  const supabase = await createClient()

  // Fetch users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch locations
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch managers (users with manager or super_admin role)
  const { data: managers } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['manager', 'super_admin'])
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  return (
    <div>
      <Header
        title="Gestion des utilisateurs"
        description="Gerer les comptes, roles et equipes"
      />
      <div className="p-6">
        <UserManagement
          users={users ?? []}
          locations={locations ?? []}
          managers={managers ?? []}
        />
      </div>
    </div>
  )
}
