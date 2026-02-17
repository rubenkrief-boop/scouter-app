import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { AppSidebar } from '@/components/layout/app-sidebar'
import type { UserRole } from '@/lib/types'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile } = await getAuthProfile()

  if (!user) {
    redirect('/auth/login')
  }

  if (!profile) {
    redirect('/auth/login')
  }

  const userName = `${profile.first_name} ${profile.last_name}`.trim() || profile.email

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        userRole={profile.role as UserRole}
        userName={userName}
        userEmail={profile.email}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
