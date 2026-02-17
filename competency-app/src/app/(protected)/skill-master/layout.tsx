import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { canAccessSkillMaster } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'

export default async function SkillMasterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await getAuthProfile()

  if (!profile || !canAccessSkillMaster(profile.role as UserRole)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
