'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Module, ModuleWithChildren, QualifierWithOptions } from '@/lib/types'

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

// ============================================
// Module Qualifiers — Attribution par module
// ============================================

/**
 * Retourne un map module_id -> qualifier_ids[] pour tous les modules
 */
export async function getModuleQualifiersMap(): Promise<Record<string, string[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('module_qualifiers')
    .select('module_id, qualifier_id')

  if (error) {
    console.error('Error fetching module_qualifiers:', error)
    return {}
  }

  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.module_id]) {
      map[row.module_id] = []
    }
    map[row.module_id].push(row.qualifier_id)
  }
  return map
}

/**
 * Retourne les qualifier_ids assignes a un module specifique
 */
export async function getModuleQualifierIds(moduleId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('module_qualifiers')
    .select('qualifier_id')
    .eq('module_id', moduleId)

  if (error) {
    console.error('Error fetching module qualifier IDs:', error)
    return []
  }

  return (data ?? []).map(r => r.qualifier_id)
}

/**
 * Definit les qualifiers pour un module (delete + insert)
 */
export async function setModuleQualifiers(moduleId: string, qualifierIds: string[]) {
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

  // Supprimer les liens existants
  const { error: deleteError } = await supabase
    .from('module_qualifiers')
    .delete()
    .eq('module_id', moduleId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Inserer les nouveaux liens
  if (qualifierIds.length > 0) {
    const rows = qualifierIds.map(qId => ({
      module_id: moduleId,
      qualifier_id: qId,
    }))

    const { error: insertError } = await supabase
      .from('module_qualifiers')
      .insert(rows)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath('/skill-master/library')
  return { success: true }
}

/**
 * Charge les qualifiers avec options, groupes par module.
 * Si un module n'a aucun qualifier assigne, retourne tous les qualifiers actifs (fallback).
 * Retourne aussi les overrides par competence (byCompetency).
 */
export async function getQualifiersByModule(
  moduleIds: string[],
  allQualifiers: QualifierWithOptions[]
): Promise<{
  byModule: Record<string, QualifierWithOptions[]>
  byCompetency: Record<string, QualifierWithOptions[]>
}> {
  const mqMap = await getModuleQualifiersMap()
  const cqMap = await getCompetencyQualifiersMap()
  const byModule: Record<string, QualifierWithOptions[]> = {}
  const byCompetency: Record<string, QualifierWithOptions[]> = {}

  for (const moduleId of moduleIds) {
    const assignedIds = mqMap[moduleId]
    if (assignedIds && assignedIds.length > 0) {
      byModule[moduleId] = allQualifiers.filter(q => assignedIds.includes(q.id))
    } else {
      byModule[moduleId] = allQualifiers
    }
  }

  // Remplir les overrides par competence
  for (const [competencyId, qualifierIds] of Object.entries(cqMap)) {
    if (qualifierIds.length > 0) {
      byCompetency[competencyId] = allQualifiers.filter(q => qualifierIds.includes(q.id))
    }
  }

  return { byModule, byCompetency }
}

// ============================================
// Competency Qualifiers — Override par competence
// ============================================

/**
 * Retourne un map competency_id -> qualifier_ids[] pour toutes les competences qui ont un override
 */
export async function getCompetencyQualifiersMap(): Promise<Record<string, string[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competency_qualifiers')
    .select('competency_id, qualifier_id')

  if (error) {
    console.error('Error fetching competency_qualifiers:', error)
    return {}
  }

  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.competency_id]) {
      map[row.competency_id] = []
    }
    map[row.competency_id].push(row.qualifier_id)
  }
  return map
}

/**
 * Retourne les qualifier_ids assignes a une competence specifique
 */
export async function getCompetencyQualifierIds(competencyId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('competency_qualifiers')
    .select('qualifier_id')
    .eq('competency_id', competencyId)

  if (error) {
    console.error('Error fetching competency qualifier IDs:', error)
    return []
  }

  return (data ?? []).map(r => r.qualifier_id)
}

/**
 * Definit les qualifiers pour une competence (delete + insert)
 * Si qualifierIds est vide, supprime l'override (retour au comportement du module)
 */
export async function setCompetencyQualifiers(competencyId: string, qualifierIds: string[]) {
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

  // Supprimer les liens existants
  const { error: deleteError } = await supabase
    .from('competency_qualifiers')
    .delete()
    .eq('competency_id', competencyId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // Inserer les nouveaux liens (si vide = retour au comportement module)
  if (qualifierIds.length > 0) {
    const rows = qualifierIds.map(qId => ({
      competency_id: competencyId,
      qualifier_id: qId,
    }))

    const { error: insertError } = await supabase
      .from('competency_qualifiers')
      .insert(rows)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath('/skill-master/library')
  return { success: true }
}
