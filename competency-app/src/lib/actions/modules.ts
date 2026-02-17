'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Module, ModuleWithChildren } from '@/lib/types'

export async function getModules(): Promise<ModuleWithChildren[]> {
  const supabase = await createClient()

  // Fetch all modules with competency counts
  const { data: modules, error } = await supabase
    .from('modules')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching modules:', error)
    return []
  }

  // Fetch competency counts per module
  const { data: competencies } = await supabase
    .from('competencies')
    .select('module_id')

  const competencyCountMap: Record<string, number> = {}
  if (competencies) {
    for (const c of competencies) {
      competencyCountMap[c.module_id] = (competencyCountMap[c.module_id] || 0) + 1
    }
  }

  // Build tree structure: top-level modules with their children
  const moduleMap = new Map<string, ModuleWithChildren>()
  const topLevel: ModuleWithChildren[] = []

  for (const mod of modules as Module[]) {
    const moduleWithChildren: ModuleWithChildren = {
      ...mod,
      children: [],
      competencies: [],
    }
    moduleMap.set(mod.id, moduleWithChildren)
  }

  for (const mod of modules as Module[]) {
    const current = moduleMap.get(mod.id)!
    if (mod.parent_id && moduleMap.has(mod.parent_id)) {
      moduleMap.get(mod.parent_id)!.children!.push(current)
    } else {
      topLevel.push(current)
    }
  }

  return topLevel
}

export async function getModule(id: string): Promise<ModuleWithChildren | null> {
  const supabase = await createClient()

  const { data: module, error: moduleError } = await supabase
    .from('modules')
    .select('*')
    .eq('id', id)
    .single()

  if (moduleError) {
    console.error('Error fetching module:', moduleError)
    return null
  }

  // Fetch competencies for this module
  const { data: competencies } = await supabase
    .from('competencies')
    .select('*')
    .eq('module_id', id)
    .order('sort_order', { ascending: true })

  // Fetch child modules
  const { data: children } = await supabase
    .from('modules')
    .select('*')
    .eq('parent_id', id)
    .order('sort_order', { ascending: true })

  return {
    ...module,
    competencies: competencies ?? [],
    children: (children ?? []) as ModuleWithChildren[],
  } as ModuleWithChildren
}

export async function createModule(formData: FormData) {
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

  const code = formData.get('code') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null
  const parent_id = formData.get('parent_id') as string | null
  const icon = formData.get('icon') as string | null
  const color = formData.get('color') as string | null
  const sort_order = parseInt(formData.get('sort_order') as string) || 0

  if (!code || !name) {
    return { error: 'Le code et le nom sont requis.' }
  }

  const { error } = await supabase.from('modules').insert({
    code,
    name,
    description: description || null,
    parent_id: parent_id || null,
    icon: icon || null,
    color: color || null,
    sort_order,
    is_active: true,
    created_by: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/modules')
}

export async function updateModule(id: string, formData: FormData) {
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

  const code = formData.get('code') as string
  const name = formData.get('name') as string
  const description = formData.get('description')
  const parent_id = formData.get('parent_id')
  const icon = formData.get('icon')
  const color = formData.get('color')
  const sort_order = formData.get('sort_order')
  const is_active = formData.get('is_active')

  const updateData: Record<string, unknown> = {}
  if (code) updateData.code = code
  if (name) updateData.name = name
  if (description !== null) updateData.description = (description as string) || null
  if (parent_id !== null) updateData.parent_id = (parent_id as string) || null
  if (icon !== null) updateData.icon = (icon as string) || null
  if (color !== null) updateData.color = (color as string) || null
  if (sort_order !== null) updateData.sort_order = parseInt(sort_order as string) || 0
  if (is_active !== null) updateData.is_active = is_active === 'true'

  const { error } = await supabase
    .from('modules')
    .update(updateData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/modules')
}

export async function deleteModule(id: string) {
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
    .from('modules')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/skill-master/library')
  revalidatePath('/skill-master/modules')
}
