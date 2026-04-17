'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import type { VisitWithRelations, GeographicZone, UserRole } from '@/lib/types'

const REVALIDATE_PATH = '/visits'

// Roles that can plan visits
const PLANNER_ROLES: UserRole[] = ['super_admin', 'skill_master', 'manager', 'resp_audiologie']

// ============================================
// Helper: get location IDs accessible to user
// ============================================

async function getAccessibleLocationIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: UserRole
): Promise<string[] | 'all'> {
  if (role === 'super_admin' || role === 'skill_master' || role === 'resp_audiologie') {
    return 'all' // resp_audiologie voit tout (mais ne modifie que ses attribués)
  }

  if (role === 'manager') {
    // Centres de son équipe + centres attribués
    const [teamResult, assignedResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('location_id')
        .eq('manager_id', userId)
        .not('location_id', 'is', null),
      supabase
        .from('planner_locations')
        .select('location_id')
        .eq('profile_id', userId),
    ])
    const ids = new Set<string>()
    for (const p of (teamResult.data ?? [])) {
      if (p.location_id) ids.add(p.location_id)
    }
    for (const pl of (assignedResult.data ?? [])) {
      ids.add(pl.location_id)
    }
    return Array.from(ids)
  }

  if (role === 'worker' || role === 'formation_user') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('location_id')
      .eq('id', userId)
      .single()
    return profile?.location_id ? [profile.location_id] : []
  }

  return []
}

// Helper: get location IDs where user can CREATE/MODIFY visits
async function getModifiableLocationIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: UserRole
): Promise<string[] | 'all'> {
  if (role === 'super_admin') return 'all'

  // resp_audiologie + manager: only assigned locations
  const { data: assigned } = await supabase
    .from('planner_locations')
    .select('location_id')
    .eq('profile_id', userId)

  const assignedIds = (assigned ?? []).map((a: { location_id: string }) => a.location_id)

  if (role === 'manager') {
    // Also include team locations
    const { data: team } = await supabase
      .from('profiles')
      .select('location_id')
      .eq('manager_id', userId)
      .not('location_id', 'is', null)
    for (const p of (team ?? [])) {
      if (p.location_id && !assignedIds.includes(p.location_id)) {
        assignedIds.push(p.location_id)
      }
    }
  }

  return assignedIds
}

// ============================================
// READ
// ============================================

export async function getVisits(filters?: {
  status?: string
  locationId?: string
}): Promise<VisitWithRelations[]> {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return []

  const supabase = await createClient()

  // Auto-completion: any `planned` visit whose end_date is strictly in the past
  // flips to `completed`. Runs on every read so the UI is always consistent
  // without needing a dedicated cron.
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('visits')
    .update({ status: 'completed' })
    .eq('status', 'planned')
    .lt('end_date', today)

  let query = supabase
    .from('visits')
    .select(`
      *,
      location:locations!location_id(id, name, city, zone_id, zone:geographic_zones!zone_id(id, name, color, freq_days_admin, freq_days_manager, freq_days_resp, target_visits_admin, target_visits_manager, target_visits_resp)),
      creator:profiles!created_by(id, first_name, last_name, role)
    `)
    .order('start_date', { ascending: false })

  // Role-based filtering
  const accessibleIds = await getAccessibleLocationIds(supabase, user.id, profile.role as UserRole)
  if (accessibleIds !== 'all' && accessibleIds.length > 0) {
    query = query.in('location_id', accessibleIds)
  } else if (accessibleIds !== 'all') {
    return [] // No accessible locations
  }

  // Optional filters
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.locationId) {
    query = query.eq('location_id', filters.locationId)
  }

  const { data, error } = await query

  if (error) {
    logger.error('visits.getVisits', error)
    return []
  }

  return (data ?? []) as VisitWithRelations[]
}

export async function getVisit(id: string): Promise<VisitWithRelations | null> {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      location:locations!location_id(id, name, city, zone_id, zone:geographic_zones!zone_id(id, name, color)),
      creator:profiles!created_by(id, first_name, last_name, role)
    `)
    .eq('id', id)
    .single()

  if (error) {
    logger.error('visits.getVisit', error)
    return null
  }

  return data as VisitWithRelations
}

// ============================================
// CREATE
// ============================================

export async function createVisit(data: {
  location_id: string
  start_date: string
  end_date: string
  notes?: string
}) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { error: 'Non authentifié' }

  if (!PLANNER_ROLES.includes(profile.role as UserRole)) {
    return { error: 'Accès refusé' }
  }

  if (!data.location_id || !data.start_date || !data.end_date) {
    return { error: 'Centre, date début et date fin sont requis' }
  }

  if (data.end_date < data.start_date) {
    return { error: 'La date de fin doit être après la date de début' }
  }

  // Check modifiable locations
  const supabase = await createClient()
  const modifiable = await getModifiableLocationIds(supabase, user.id, profile.role as UserRole)
  if (modifiable !== 'all' && !modifiable.includes(data.location_id)) {
    return { error: 'Vous n\'êtes pas autorisé à planifier une visite dans ce centre' }
  }

  const { error } = await supabase.from('visits').insert({
    location_id: data.location_id,
    created_by: user.id,
    start_date: data.start_date,
    end_date: data.end_date,
    notes: data.notes?.trim() || null,
  })

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ============================================
// UPDATE
// ============================================

export async function updateVisit(id: string, data: {
  start_date?: string
  end_date?: string
  status?: 'planned' | 'completed' | 'cancelled'
  notes?: string
}) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { error: 'Non authentifié' }

  const supabase = await createClient()

  // Fetch visit to check ownership
  const { data: visit, error: fetchError } = await supabase
    .from('visits')
    .select('created_by, location_id')
    .eq('id', id)
    .single()

  if (fetchError || !visit) return { error: 'Visite introuvable' }

  // Admin can update anything
  if (profile.role !== 'super_admin') {
    // Manager can only update their own
    if (profile.role === 'manager' && visit.created_by !== user.id) {
      return { error: 'Vous ne pouvez modifier que vos propres visites' }
    }
    // Resp_audiologie can update visits in their assigned locations
    if (profile.role === 'resp_audiologie') {
      const modifiable = await getModifiableLocationIds(supabase, user.id, profile.role as UserRole)
      if (modifiable !== 'all' && !modifiable.includes(visit.location_id)) {
        return { error: 'Ce centre n\'est pas dans vos attributions' }
      }
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.start_date !== undefined) updateData.start_date = data.start_date
  if (data.end_date !== undefined) updateData.end_date = data.end_date
  if (data.status !== undefined) updateData.status = data.status
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null

  const { error } = await supabase.from('visits').update(updateData).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  revalidatePath(`/visits/${id}`)
  return { success: true }
}

// ============================================
// CANCEL
// ============================================

export async function cancelVisit(id: string) {
  return updateVisit(id, { status: 'cancelled' })
}

// ============================================
// REOPEN (completed → planned) — undo auto-completion
// ============================================

export async function reopenVisit(id: string) {
  return updateVisit(id, { status: 'planned' })
}

// ============================================
// DELETE
// ============================================

export async function deleteVisit(id: string) {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { error: 'Non authentifié' }

  const supabase = await createClient()

  const { data: visit, error: fetchError } = await supabase
    .from('visits')
    .select('created_by, location_id')
    .eq('id', id)
    .single()
  if (fetchError || !visit) return { error: 'Visite introuvable' }

  // Same ownership rules as updateVisit
  if (profile.role !== 'super_admin') {
    if (profile.role === 'manager' && visit.created_by !== user.id) {
      return { error: 'Vous ne pouvez supprimer que vos propres visites' }
    }
    if (profile.role === 'resp_audiologie') {
      const modifiable = await getModifiableLocationIds(supabase, user.id, profile.role as UserRole)
      if (modifiable !== 'all' && !modifiable.includes(visit.location_id)) {
        return { error: 'Ce centre n\'est pas dans vos attributions' }
      }
    }
  }

  const { error } = await supabase.from('visits').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ============================================
// DASHBOARD: Overdue centers
// ============================================

export interface OverdueCenter {
  location_id: string
  location_name: string
  zone_name: string
  zone_color: string | null
  target_days: number
  last_visit_date: string | null
  days_since_last: number
}

export async function getOverdueCenters(): Promise<OverdueCenter[]> {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return []
  if (!PLANNER_ROLES.includes(profile.role as UserRole)) return []

  const supabase = await createClient()

  // Get all active locations with zones
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, zone_id, zone:geographic_zones!zone_id(id, name, color, freq_days_admin, freq_days_manager, freq_days_resp, target_visits_admin, target_visits_manager, target_visits_resp)')
    .eq('is_active', true)
    .not('zone_id', 'is', null)

  if (!locations || locations.length === 0) return []

  // Get last completed visit per location
  const { data: visits } = await supabase
    .from('visits')
    .select('location_id, start_date')
    .eq('status', 'completed')
    .order('start_date', { ascending: false })

  const lastVisitByLocation = new Map<string, string>()
  for (const v of (visits ?? [])) {
    if (!lastVisitByLocation.has(v.location_id)) {
      lastVisitByLocation.set(v.location_id, v.start_date)
    }
  }

  // Determine target frequency based on viewer's role
  const isAdmin = profile.role === 'super_admin'
  const isManager = profile.role === 'manager'
  const now = new Date()

  const overdue: OverdueCenter[] = []

  for (const loc of locations) {
    const zone = loc.zone as unknown as GeographicZone | null
    if (!zone) continue

    const targetDays = isAdmin ? zone.freq_days_admin : isManager ? zone.freq_days_manager : zone.freq_days_resp
    if (targetDays === 0) continue // 0 = non concerné, pas d'alerte
    const lastVisit = lastVisitByLocation.get(loc.id)
    const daysSince = lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      : 999 // Never visited

    if (daysSince > targetDays) {
      overdue.push({
        location_id: loc.id,
        location_name: loc.name,
        zone_name: zone.name,
        zone_color: zone.color,
        target_days: targetDays,
        last_visit_date: lastVisit || null,
        days_since_last: daysSince,
      })
    }
  }

  // Sort by most overdue first
  overdue.sort((a, b) => b.days_since_last - a.days_since_last)
  return overdue
}

// ============================================
// DASHBOARD: Upcoming visits
// ============================================

export async function getUpcomingVisits(days: number = 30): Promise<VisitWithRelations[]> {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return []

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let query = supabase
    .from('visits')
    .select(`
      *,
      location:locations!location_id(id, name, city),
      creator:profiles!created_by(id, first_name, last_name, role)
    `)
    .eq('status', 'planned')
    .gte('start_date', today)
    .lte('start_date', futureDate)
    .order('start_date', { ascending: true })
    .limit(10)

  // Role filtering
  const accessibleIds = await getAccessibleLocationIds(supabase, user.id, profile.role as UserRole)
  if (accessibleIds !== 'all' && accessibleIds.length > 0) {
    query = query.in('location_id', accessibleIds)
  } else if (accessibleIds !== 'all') {
    return []
  }

  const { data, error } = await query
  if (error) {
    logger.error('visits.getUpcomingVisits', error)
    return []
  }

  return (data ?? []) as VisitWithRelations[]
}

// ============================================
// Planner locations (attributions)
// ============================================

export async function getPlannerLocations(profileId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('planner_locations')
    .select('location_id')
    .eq('profile_id', profileId)

  return (data ?? []).map(d => d.location_id)
}

export async function setPlannerLocations(profileId: string, locationIds: string[]) {
  const { profile } = await getAuthProfile()
  if (!profile || profile.role !== 'super_admin') {
    return { error: 'Accès refusé' }
  }

  const supabase = await createClient()

  // Delete existing
  await supabase.from('planner_locations').delete().eq('profile_id', profileId)

  // Insert new
  if (locationIds.length > 0) {
    const rows = locationIds.map(lid => ({ profile_id: profileId, location_id: lid }))
    const { error } = await supabase.from('planner_locations').insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/settings')
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
