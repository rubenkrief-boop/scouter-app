import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName } from '@/lib/utils'

// Auto-link formation inscriptions to a profile by name match
async function linkFormationInscriptions(
  adminClient: ReturnType<typeof createAdminClient>,
  profileId: string,
  firstName: string,
  lastName: string
) {
  if (!firstName || !lastName) return

  const profileKey = normalizeName(firstName) + normalizeName(lastName)

  // Fetch all unlinked inscriptions (paginated to handle >1000)
  let offset = 0
  const PAGE_SIZE = 1000
  let totalLinked = 0

  while (true) {
    const { data: unlinked } = await adminClient
      .from('formation_inscriptions')
      .select('id, nom, prenom')
      .is('profile_id', null)
      .range(offset, offset + PAGE_SIZE - 1)

    if (!unlinked || unlinked.length === 0) break

    for (const insc of unlinked) {
      const inscKey = normalizeName(insc.prenom) + normalizeName(insc.nom)
      if (inscKey === profileKey) {
        await adminClient
          .from('formation_inscriptions')
          .update({ profile_id: profileId })
          .eq('id', insc.id)
        totalLinked++
      }
    }

    if (unlinked.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  if (totalLinked > 0) {
    console.log(`[Auth Callback] Linked ${totalLinked} formation inscriptions to profile ${firstName} ${lastName}`)
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  // Validate redirect target - must be safe relative path (no protocol, no backslash tricks)
  const safeNext = /^\/[a-zA-Z0-9\-_/]*$/.test(next) ? next : '/dashboard'

  if (code) {
    const cookieStore = await cookies()

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
            } catch {
              // Cookie set from Server Component context - safe to ignore
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Verify the user's email domain is @vivason.fr or @vivason.ma
      const { data: { user } } = await supabase.auth.getUser()
      const allowedDomains = ['@vivason.fr', '@vivason.ma']

      if (user?.email && !allowedDomains.some(d => user.email!.endsWith(d))) {
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
          .select('id, first_name, last_name')
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

            // 1. Transfer all formation inscription links from old profile to new
            await adminClient
              .from('formation_inscriptions')
              .update({ profile_id: user.id })
              .eq('profile_id', oldId)

            // 2. Transfer evaluation references
            await adminClient
              .from('evaluations')
              .update({ audioprothesiste_id: user.id })
              .eq('audioprothesiste_id', oldId)
            await adminClient
              .from('evaluations')
              .update({ evaluator_id: user.id })
              .eq('evaluator_id', oldId)

            // 3. Transfer job profile assignments
            await adminClient
              .from('audioprothesiste_assignments')
              .update({ audioprothesiste_id: user.id })
              .eq('audioprothesiste_id', oldId)

            // 4. Delete the old auth user (created by Excel import with random password)
            try {
              await adminClient.auth.admin.deleteUser(oldId)
            } catch {
              // Old auth user may already be gone
            }

            // 5. Delete the old profile (safe now: all references transferred)
            await adminClient
              .from('profiles')
              .delete()
              .eq('id', oldId)

            // 6. Create the new profile with the Google Auth ID, preserving imported data
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

            // 7. Auto-link any remaining unlinked inscriptions by name match
            await linkFormationInscriptions(
              adminClient,
              user.id,
              preImportedProfile.first_name,
              preImportedProfile.last_name
            )
          } else {
            // Completely new user - create a fresh profile
            const meta = user.user_metadata || {}
            const firstName = meta.given_name || meta.first_name || meta.full_name?.split(' ')[0] || ''
            const lastName = meta.family_name || meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || ''

            await adminClient.from('profiles').upsert({
              id: user.id,
              email: user.email || '',
              first_name: firstName,
              last_name: lastName,
              role: 'worker',
              avatar_url: meta.avatar_url || null,
              is_active: true,
            })

            // Auto-link formation inscriptions by name match
            await linkFormationInscriptions(adminClient, user.id, firstName, lastName)
          }
        } else {
          // Profile already exists - still try to link any unlinked inscriptions
          // (handles case where inscriptions were added after first login)
          await linkFormationInscriptions(
            adminClient,
            user.id,
            existingProfile.first_name,
            existingProfile.last_name
          )
        }
      }

      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=could_not_verify`)
}
