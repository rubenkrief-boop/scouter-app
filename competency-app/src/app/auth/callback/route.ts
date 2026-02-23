import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    console.log('Callback received code:', code.substring(0, 10) + '...')
    console.log('Cookies available:', allCookies.map(c => c.name).join(', '))
    console.log('Code verifier cookie exists:', allCookies.some(c => c.name.includes('code_verifier')))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, { ...options, path: '/' })
              )
            } catch (e) {
              console.error('Cookie set error:', e)
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('OAuth exchange error:', error.message, error.status)
    }

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

      // Ensure profile exists and merge with any pre-imported profile
      if (user) {
        const adminClient = createAdminClient()

        // Check if a profile already exists with this Auth user ID
        const { data: existingProfile } = await adminClient
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingProfile) {
          // Check if a profile was pre-imported via Excel with the same email
          const { data: preImportedProfile } = await adminClient
            .from('profiles')
            .select('*')
            .eq('email', user.email || '')
            .neq('id', user.id)
            .single()

          if (preImportedProfile) {
            const oldId = preImportedProfile.id

            // 1. Delete the old auth user (created by Excel import with random password)
            try {
              await adminClient.auth.admin.deleteUser(oldId)
            } catch {
              // Old auth user may already be gone
            }

            // 2. Delete the old profile
            await adminClient
              .from('profiles')
              .delete()
              .eq('id', oldId)

            // 3. Create the new profile with the Google Auth ID, preserving imported data
            await adminClient.from('profiles').upsert({
              id: user.id,
              email: user.email || '',
              first_name: preImportedProfile.first_name,
              last_name: preImportedProfile.last_name,
              role: preImportedProfile.role,
              job_title: preImportedProfile.job_title,
              manager_id: preImportedProfile.manager_id,
              location_id: preImportedProfile.location_id,
              avatar_url: user.user_metadata?.avatar_url || preImportedProfile.avatar_url,
              is_active: preImportedProfile.is_active,
            })
          } else {
            // Completely new user - create a fresh profile
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
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=could_not_verify`)
}
