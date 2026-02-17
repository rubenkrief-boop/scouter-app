import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getDashboardPath } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'

export default async function DashboardPage() {
  const { user, profile } = await getAuthProfile()

  if (!user) redirect('/auth/login')
  if (!profile) redirect('/auth/login')

  redirect(getDashboardPath(profile.role as UserRole))
}
