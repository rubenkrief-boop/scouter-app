'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Competency } from '@/lib/types'

export async function getCompetencies(moduleId: string): Promise<Competency[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competencies')
    .select('*')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching competencies:', error)
    return []
  }

  return (data ?? []) as Competency[]
}

export async function createCompetency(formData: FormData) {
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

  const module_id = formData.get('module_id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const external_id = formData.get('external_id') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string) || 0

  if (!module_id || !name) {
    return { error: 'module_id et nom sont requis.' }
  }

  const { error } = await supabase.from('competencies').insert({
    module_id,
    name,
    description: description || null,
    external_id: external_id || null,
    sort_order,
    is_active: true,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath(`/skill-master/modules/${module_id}`)
}

export async function updateCompetency(id: string, formData: FormData) {
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
  const external_id = formData.get('external_id')
  const sort_order = formData.get('sort_order')
  const is_active = formData.get('is_active')

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name
  if (description !== null) updateData.description = (description as string) || null
  if (external_id !== null) updateData.external_id = (external_id as string) || null
  if (sort_order !== null) updateData.sort_order = parseInt(sort_order as string) || 0
  if (is_active !== null) updateData.is_active = is_active === 'true'

  const { error } = await supabase
    .from('competencies')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
}

export async function deleteCompetency(id: string) {
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
    .from('competencies')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
}
