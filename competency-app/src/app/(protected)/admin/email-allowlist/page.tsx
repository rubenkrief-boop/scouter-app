import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AllowlistManager } from '@/components/admin/allowlist-manager'
import { getAllowlist } from '@/lib/actions/email-allowlist'

export const metadata = { title: 'Allowlist email — Admin' }

export default async function EmailAllowlistPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')
  if (profile.role !== 'super_admin') redirect('/dashboard')

  const rows = await getAllowlist()

  return (
    <>
      <Header
        title="Allowlist emails"
        description="Liste des emails autorises a se connecter — actuellement inactive"
        userRole={profile.role}
      />
      <main className="p-6 space-y-6">
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>L&apos;enforcement de l&apos;allowlist est desactive.</strong>{' '}
              Tout email <code>@vivason.fr</code> ou <code>@vivason.ma</code>
              {' '}peut se connecter actuellement, peu importe ce qui est dans
              cette table. Cette page permet de pre-configurer la liste pour
              une activation future (decommentage du bloc dans{' '}
              <code>src/app/auth/callback/route.ts</code>).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emails enregistres ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <AllowlistManager
              rows={rows}
              currentUserEmail={user.email ?? ''}
            />
          </CardContent>
        </Card>
      </main>
    </>
  )
}
