import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { canAccessEvaluator } from '@/lib/utils-app/roles'
import type { UserRole } from '@/lib/types'

export default async function EvaluatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await getAuthProfile()

  if (!profile || !canAccessEvaluator(profile.role as UserRole)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
