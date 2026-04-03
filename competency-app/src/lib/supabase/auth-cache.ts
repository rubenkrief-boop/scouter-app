import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

/**
 * Cached auth helper — deduplicates getUser() + profile fetch
 * across layouts and pages in a single request cycle.
 * React `cache()` ensures this runs only ONCE per server request.
 */
export const getAuthProfile = cache(async (): Promise<{
  user: User | null
  profile: Profile | null
}> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Auth cache - profile fetch error:', profileError.message)
  }

  return { user, profile: (profile as Profile) ?? null }
})
