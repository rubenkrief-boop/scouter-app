'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { QualifierWithOptions, QualifierType } from '@/lib/types'

export async function getQualifiers(): Promise<QualifierWithOptions[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching qualifiers:', error)
    return []
  }

  // Sort options within each qualifier
  return (data ?? []).map((q) => ({
    ...q,
    qualifier_options: (q.qualifier_options ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  })) as QualifierWithOptions[]
}

export async function getQualifier(id: string): Promise<QualifierWithOptions | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('qualifiers')
    .select('*, qualifier_options(*)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching qualifier:', error)
    return null
  }

  return {
    ...data,
    qualifier_options: (data.qualifier_options ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  } as QualifierWithOptions
}

export async function createQualifier(formData: FormData) {
  const supabase = await createClient()

  // Check user role
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
  const qualifier_type = formData.get('qualifier_type') as QualifierType
  const sort_order = parseInt(formData.get('sort_order') as string) || 0

  if (!name || !qualifier_type) {
    return { error: 'Le nom et le type sont requis.' }
  }

  const { error } = await supabase.from('qualifiers').insert({
    name,
    qualifier_type,
    sort_order,
    is_active: true,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}

export async function updateQualifier(id: string, formData: FormData) {
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
  const qualifier_type = formData.get('qualifier_type') as QualifierType
  const sort_order = formData.get('sort_order')
  const is_active = formData.get('is_active')

  const updateData: Record<string, unknown> = {}
  if (name) updateData.name = name
  if (qualifier_type) updateData.qualifier_type = qualifier_type
  if (sort_order !== null) updateData.sort_order = parseInt(sort_order as string) || 0
  if (is_active !== null) updateData.is_active = is_active === 'true'

  const { error } = await supabase
    .from('qualifiers')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}

export async function deleteQualifier(id: string) {
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
    .from('qualifiers')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}

export async function createQualifierOption(formData: FormData) {
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

  const qualifier_id = formData.get('qualifier_id') as string
  const label = formData.get('label') as string
  const value = parseInt(formData.get('value') as string)
  const icon = formData.get('icon') as string | null
  const color = formData.get('color') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string) || 0

  if (!qualifier_id || !label || isNaN(value)) {
    return { error: 'qualifier_id, label et value sont requis.' }
  }

  const { error } = await supabase.from('qualifier_options').insert({
    qualifier_id,
    label,
    value,
    icon: icon || null,
    color: color || null,
    sort_order,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}

export async function updateQualifierOption(id: string, formData: FormData) {
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

  const label = formData.get('label') as string
  const value = formData.get('value')
  const icon = formData.get('icon')
  const color = formData.get('color')
  const sort_order = formData.get('sort_order')

  const updateData: Record<string, unknown> = {}
  if (label) updateData.label = label
  if (value !== null) updateData.value = parseInt(value as string)
  if (icon !== null) updateData.icon = (icon as string) || null
  if (color !== null) updateData.color = (color as string) || null
  if (sort_order !== null) updateData.sort_order = parseInt(sort_order as string) || 0

  const { error } = await supabase
    .from('qualifier_options')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}

export async function deleteQualifierOption(id: string) {
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
    .from('qualifier_options')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/qualifiers')
}
