import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Verify the user's email domain is @vivason.fr
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email && !user.email.endsWith('@vivason.fr')) {
        // Sign out unauthorized user
        await supabase.auth.signOut()
        return NextResponse.redirect(
          `${origin}/auth/login?error=domain_not_allowed`
        )
      }

      // Safety net: ensure profile exists (in case the DB trigger didn't fire)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          const adminClient = createAdminClient()
          const meta = user.user_metadata || {}
          await adminClient.from('profiles').upsert({
            id: user.id,
            email: user.email || '',
            first_name: meta.given_name || meta.first_name || meta.full_name?.split(' ')[0] || '',
            last_name: meta.family_name || meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || '',
            role: 'worker',
            avatar_url: meta.avatar_url || null,
            is_active: true,
          })
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=could_not_verify`)
}
