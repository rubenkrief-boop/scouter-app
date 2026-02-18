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
          // No profile for this Auth ID yet.
          // Check if a profile was pre-imported via Excel with the same email
          const { data: preImportedProfile } = await adminClient
            .from('profiles')
            .select('*')
            .eq('email', user.email || '')
            .neq('id', user.id)
            .single()

          if (preImportedProfile) {
            // A profile was pre-imported with a different Auth ID (from Excel import).
            // We need to transfer the data to the new Google Auth user ID.
            //
            // Strategy: delete the old profile, then create a new one with the
            // Google Auth ID but keeping all the pre-imported data (role, manager, etc.)

            const oldId = preImportedProfile.id

            // 1. Delete the old auth user (created by Excel import with random password)
            try {
              await adminClient.auth.admin.deleteUser(oldId)
            } catch {
              // Old auth user may already be gone
            }

            // 2. Delete the old profile (FK CASCADE will clean up related records)
            // Since this is a brand-new import with no evaluations yet, this is safe
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

            // Role, manager, location, job_title are all preserved from the import!
          } else {
            // Completely new user (not pre-imported) - create a fresh profile
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
