'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { JobProfile, JobProfileCompetency } from '@/lib/types'

export async function getJobProfiles(): Promise<JobProfile[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_profiles')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching job profiles:', error)
    return []
  }

  return (data ?? []) as JobProfile[]
}

export async function getJobProfile(
  id: string
): Promise<{ profile: JobProfile; expectedScores: JobProfileCompetency[] } | null> {
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('job_profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (profileError) {
    console.error('Error fetching job profile:', profileError)
    return null
  }

  const { data: expectedScores, error: scoresError } = await supabase
    .from('job_profile_competencies')
    .select('*')
    .eq('job_profile_id', id)

  if (scoresError) {
    console.error('Error fetching expected scores:', scoresError)
    return null
  }

  return {
    profile: profile as JobProfile,
    expectedScores: (expectedScores ?? []) as JobProfileCompetency[],
  }
}

export async function createJobProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'skill_master' && profile.role !== 'super_admin')) {
    return { error: 'Acces refuse. Role skill_master ou super_admin requis.' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  if (!name) {
    return { error: 'Le nom est requis.' }
  }

  const { error } = await supabase.from('job_profiles').insert({
    name,
    description: description || null,
    is_active: true,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/job-profiles')
}

export async function updateJobProfile(id: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'skill_master' && profile.role !== 'super_admin')) {
    return { error: 'Acces refuse. Role skill_master ou super_admin requis.' }
  }

  const name = formData.get('name') as string
  const description = formData.get('description')
  const is_active = formData.get('is_active')

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name
  if (description !== null) updateData.description = (description as string) || null
  if (is_active !== null) updateData.is_active = is_active === 'true'

  const { error } = await supabase
    .from('job_profiles')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/job-profiles')
  revalidatePath(`/skill-master/job-profiles/${id}`)
}

export async function deleteJobProfile(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'skill_master' && profile.role !== 'super_admin')) {
    return { error: 'Acces refuse. Role skill_master ou super_admin requis.' }
  }

  const { error } = await supabase
    .from('job_profiles')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/job-profiles')
}

export async function updateExpectedScore(
  jobProfileId: string,
  moduleId: string,
  score: number
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'skill_master' && profile.role !== 'super_admin')) {
    return { error: 'Acces refuse. Role skill_master ou super_admin requis.' }
  }

  // Check if an entry already exists
  const { data: existing } = await supabase
    .from('job_profile_competencies')
    .select('id')
    .eq('job_profile_id', jobProfileId)
    .eq('module_id', moduleId)
    .single()

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('job_profile_competencies')
      .update({ expected_score: score })
      .eq('id', existing.id)

    if (error) {
      return { error: error.message }
    }
  } else {
    // Insert new entry
    const { error } = await supabase
      .from('job_profile_competencies')
      .insert({
        job_profile_id: jobProfileId,
        module_id: moduleId,
        expected_score: score,
      })

    if (error) {
      return { error: error.message }
    }
  }

  revalidatePath(`/skill-master/job-profiles/${jobProfileId}`)
}
