import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { LEGAL_VERSION } from '@/lib/legal'
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

  // Acceptation des CGU obligatoire avant tout acces a l'app. Si version
  // pas encore acceptee (1er login ou bump LEGAL_VERSION), redirection
  // forcee vers /accept-terms (hors (protected)/, pas de boucle).
  if (profile.legal_accepted_version !== LEGAL_VERSION) {
    redirect('/accept-terms')
  }

  const userName = `${profile.first_name} ${profile.last_name}`.trim() || profile.email

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        userRole={profile.role as UserRole}
        userName={userName}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
