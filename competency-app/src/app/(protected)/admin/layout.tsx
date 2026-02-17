import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { canAccessAdmin } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await getAuthProfile()

  if (!profile || !canAccessAdmin(profile.role as UserRole)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
