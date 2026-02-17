import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

/**
 * Cached auth helper — deduplicates getUser() + profile fetch
 * across layouts and pages in a single request cycle.
 * React `cache()` ensures this runs only ONCE per server request.
 */
export const getAuthProfile = cache(async (): Promise<{
  user: any | null
  profile: Profile | null
}> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile: profile as Profile | null }
})
