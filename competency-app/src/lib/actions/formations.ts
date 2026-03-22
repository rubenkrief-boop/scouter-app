'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName } from '@/lib/utils'
import type {
  FormationSession,
  FormationAtelier,
  FormationInscription,
  FormationInscriptionWithSession,
  FormationAtelierWithSession,
  FormationProgrammeFile,
  FormationProgrammeSetting,
  FormationProgrammeSettingWithCount,
  FormationType,
} from '@/lib/types'
import type { UserRole } from '@/lib/types'

// ============================================
// Auth helper: require admin roles for mutations
// ============================================

const ADMIN_ROLES: UserRole[] = ['super_admin', 'skill_master', 'manager']

async function requireFormationAdmin(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !ADMIN_ROLES.includes(profile.role as UserRole)) {
    return { error: 'Accès refusé' }
  }

  return {}
}

// ============================================
// READ: Sessions
// ============================================

export async function getFormationSessions(): Promise<FormationSession[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formation_sessions')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching formation sessions:', error)
    return []
  }
  return (data ?? []) as FormationSession[]
}

// ============================================
// READ: Ateliers
// ============================================

export async function getFormationAteliers(
  sessionId?: string,
  type?: 'Audio' | 'Assistante'
): Promise<FormationAtelierWithSession[]> {
  const supabase = await createClient()
  let query = supabase
    .from('formation_ateliers')
    .select('*, session:formation_sessions!formation_ateliers_session_id_fkey(*)')
    .order('sort_order', { ascending: true })

  if (sessionId) query = query.eq('session_id', sessionId)
  if (type) query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching formation ateliers:', error)
    return []
  }
  return (data ?? []) as FormationAtelierWithSession[]
}

// ============================================
// READ: Inscriptions (participants)
// ============================================

interface InscriptionFilters {
  search?: string
  type?: 'Audio' | 'Assistante'
  programme?: string
  statut?: 'Succursale' | 'Franchise'
}

// Supabase caps at 1000 rows per request (server-side db_max_rows).
// This helper paginates to fetch all rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginatedFetch<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) {
      console.error('Paginated fetch error:', error)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

export async function getFormationInscriptions(
  sessionId?: string,
  filters?: InscriptionFilters
): Promise<FormationInscriptionWithSession[]> {
  const supabase = await createClient()

  const buildQuery = () => {
    let query = supabase
      .from('formation_inscriptions')
      .select('*, session:formation_sessions!formation_inscriptions_session_id_fkey(*)')
      .order('nom', { ascending: true })

    if (sessionId) query = query.eq('session_id', sessionId)
    if (filters?.type) query = query.eq('type', filters.type)
    if (filters?.programme) query = query.eq('programme', filters.programme)
    if (filters?.statut) query = query.eq('statut', filters.statut)
    if (filters?.search) {
      // Sanitize search input: escape special Supabase/PostgREST filter characters
      const sanitized = filters.search.replace(/[%_\\().,]/g, '')
      if (sanitized.length > 0) {
        query = query.or(`nom.ilike.%${sanitized}%,prenom.ilike.%${sanitized}%,centre.ilike.%${sanitized}%`)
      }
    }
    return query
  }

  return paginatedFetch<FormationInscriptionWithSession>(buildQuery)
}

// ============================================
// READ: Stats agrégées
// ============================================

export interface FormationStats {
  totalParticipants: number
  audio: number
  assistante: number
  succursale: number
  franchise: number
  dpc: number
  byProgramme: Record<string, number>
}

export async function getFormationStats(sessionId?: string): Promise<FormationStats> {
  const supabase = await createClient()

  const buildQuery = () => {
    let query = supabase.from('formation_inscriptions').select('type, statut, programme, dpc')
    if (sessionId) query = query.eq('session_id', sessionId)
    return query
  }

  const data = await paginatedFetch<{ type: string; statut: string; programme: string; dpc: boolean }>(buildQuery)
  if (!data.length) return { totalParticipants: 0, audio: 0, assistante: 0, succursale: 0, franchise: 0, dpc: 0, byProgramme: {} }

  const stats: FormationStats = {
    totalParticipants: data.length,
    audio: data.filter(d => d.type === 'Audio').length,
    assistante: data.filter(d => d.type === 'Assistante').length,
    succursale: data.filter(d => d.statut === 'Succursale').length,
    franchise: data.filter(d => d.statut === 'Franchise').length,
    dpc: data.filter(d => d.dpc).length,
    byProgramme: {},
  }

  for (const d of data) {
    stats.byProgramme[d.programme] = (stats.byProgramme[d.programme] || 0) + 1
  }

  return stats
}

// ============================================
// READ: Worker formations (pour profil)
// ============================================

export async function getWorkerFormations(profileId: string): Promise<FormationInscriptionWithSession[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formation_inscriptions')
    .select('*, session:formation_sessions!formation_inscriptions_session_id_fkey(*)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching worker formations:', error)
    return []
  }
  return (data ?? []) as FormationInscriptionWithSession[]
}

// ============================================
// READ: Programme ateliers mapping
// ============================================

export async function getFormationProgrammeAteliers(
  sessionId: string,
  type: 'Audio' | 'Assistante',
  programme: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formation_programme_ateliers')
    .select('atelier_id, atelier:formation_ateliers!formation_programme_ateliers_atelier_id_fkey(nom)')
    .eq('session_id', sessionId)
    .eq('type', type)
    .eq('programme', programme)

  if (error) {
    console.error('Error fetching programme ateliers:', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => d.atelier?.nom).filter(Boolean)
}

// ============================================
// READ: All inscriptions for all sessions (for doublons)
// ============================================

export async function getAllFormationInscriptions(): Promise<FormationInscriptionWithSession[]> {
  const supabase = await createClient()

  const buildQuery = () =>
    supabase
      .from('formation_inscriptions')
      .select('*, session:formation_sessions!formation_inscriptions_session_id_fkey(*)')
      .order('nom', { ascending: true })

  return paginatedFetch<FormationInscriptionWithSession>(buildQuery)
}

// ============================================
// READ: All programme-atelier mappings (batch)
// ============================================

export interface ProgrammeAtelierMapping {
  session_id: string
  type: string
  programme: string
  atelier_id: string
  atelier_nom: string
}

export async function getAllProgrammeAtelierMappings(): Promise<ProgrammeAtelierMapping[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formation_programme_ateliers')
    .select('session_id, type, programme, atelier_id, atelier:formation_ateliers!formation_programme_ateliers_atelier_id_fkey(nom)')

  if (error) {
    console.error('Error fetching programme-atelier mappings:', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => ({
    session_id: d.session_id,
    type: d.type,
    programme: d.programme,
    atelier_id: d.atelier_id,
    atelier_nom: d.atelier?.nom || '',
  }))
}

// ============================================
// READ: Team profiles (for inscription selector)
// ============================================

export interface TeamProfile {
  id: string
  first_name: string
  last_name: string
  role: string
  location_id: string | null
  location_name: string | null
}

export async function getTeamProfiles(): Promise<TeamProfile[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return []

  // Admin / skill_master → all active profiles
  // Manager → only profiles assigned to this manager
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, role, location_id, location:locations!profiles_location_id_fkey(name)')
    .eq('is_active', true)
    .order('last_name', { ascending: true })

  if (profile.role === 'manager') {
    query = query.eq('manager_id', user.id)
  } else if (!['super_admin', 'skill_master'].includes(profile.role)) {
    // Not authorized
    return []
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching team profiles:', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    role: p.role,
    location_id: p.location_id,
    location_name: p.location?.name ?? null,
  }))
}

// ============================================
// CRUD: Sessions
// ============================================

export async function createFormationSession(data: {
  code: string
  label: string
  date_info?: string
  sort_order?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('formation_sessions')
    .insert({
      code: data.code,
      label: data.label,
      date_info: data.date_info || null,
      sort_order: data.sort_order ?? 0,
      is_active: true,
    })

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function updateFormationSession(id: string, data: {
  label?: string
  date_info?: string
  sort_order?: number
  is_active?: boolean
  registration_open?: boolean
}) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_sessions')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteFormationSession(id: string) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_sessions')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

// ============================================
// CRUD: Ateliers
// ============================================

export async function createFormationAtelier(data: {
  session_id: string
  nom: string
  formateur?: string
  duree?: string
  type: 'Audio' | 'Assistante'
  etat?: 'Terminé' | 'En cours' | 'Pas commencé'
  programmes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_ateliers')
    .insert({
      session_id: data.session_id,
      nom: data.nom,
      formateur: data.formateur || null,
      duree: data.duree || null,
      type: data.type,
      etat: data.etat || 'Pas commencé',
      programmes: data.programmes || null,
      sort_order: 0,
    })

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function updateFormationAtelier(id: string, data: {
  nom?: string
  formateur?: string
  duree?: string
  type?: 'Audio' | 'Assistante'
  etat?: 'Terminé' | 'En cours' | 'Pas commencé'
  programmes?: string
}) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_ateliers')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteFormationAtelier(id: string) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('formation_ateliers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

// ============================================
// CRUD: Inscriptions
// ============================================

export async function createFormationInscription(data: {
  session_id: string
  nom: string
  prenom: string
  type: 'Audio' | 'Assistante'
  statut: 'Succursale' | 'Franchise'
  programme: string
  centre?: string
  dpc?: boolean
  profile_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Get caller role
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile) return { error: 'Profil introuvable' }

  // Manager: can only inscribe members of their team
  if (callerProfile.role === 'manager' && data.profile_id) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, manager_id')
      .eq('id', data.profile_id)
      .single()

    if (!targetProfile || targetProfile.manager_id !== user.id) {
      return { error: 'Vous ne pouvez inscrire que les membres de votre équipe' }
    }
  }

  const { error } = await supabase
    .from('formation_inscriptions')
    .insert({
      session_id: data.session_id,
      nom: data.nom,
      prenom: data.prenom,
      type: data.type,
      statut: data.statut,
      programme: data.programme,
      centre: data.centre || null,
      dpc: data.dpc ?? false,
      profile_id: data.profile_id || null,
    })

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function updateFormationInscription(id: string, data: {
  nom?: string
  prenom?: string
  type?: 'Audio' | 'Assistante'
  statut?: 'Succursale' | 'Franchise'
  programme?: string
  centre?: string
  dpc?: boolean
  profile_id?: string | null
}) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_inscriptions')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteFormationInscription(id: string) {
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('formation_inscriptions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

// ============================================
// Auto-link inscriptions to profiles
// ============================================

export async function autoLinkInscriptions() {
  const supabase = await createClient()

  // Get all unlinked inscriptions (paginated to avoid 1000-row limit)
  const inscriptions = await paginatedFetch<{ id: string; nom: string; prenom: string }>(
    () => supabase.from('formation_inscriptions').select('id, nom, prenom').is('profile_id', null)
  )

  if (inscriptions.length === 0) return { linked: 0 }

  // Get all active profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)

  if (!profiles) return { linked: 0 }

  let linked = 0
  for (const insc of inscriptions) {
    const key = normalizeName(insc.prenom) + normalizeName(insc.nom)
    const match = profiles.find(p =>
      normalizeName(p.first_name) + normalizeName(p.last_name) === key
    )
    if (match) {
      await supabase
        .from('formation_inscriptions')
        .update({ profile_id: match.id })
        .eq('id', insc.id)
      linked++
    }
  }

  revalidatePath('/formations')
  return { linked }
}

// ============================================
// READ: Programme files
// ============================================

export async function getFormationProgrammeFiles(
  sessionId?: string
): Promise<FormationProgrammeFile[]> {
  const supabase = await createClient()
  let query = supabase
    .from('formation_programme_files')
    .select('*')
    .order('created_at', { ascending: false })

  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) {
    console.error('Error fetching programme files:', error)
    return []
  }
  return (data ?? []) as FormationProgrammeFile[]
}

// ============================================
// READ: Programme settings with inscription count
// ============================================

export async function getFormationProgrammeSettings(
  sessionId?: string
): Promise<FormationProgrammeSettingWithCount[]> {
  const supabase = await createClient()

  // 1. Fetch settings
  let settingsQuery = supabase
    .from('formation_programme_settings')
    .select('*')
    .order('type', { ascending: true })
    .order('programme', { ascending: true })

  if (sessionId) settingsQuery = settingsQuery.eq('session_id', sessionId)

  const { data: settings, error: settingsError } = await settingsQuery
  if (settingsError) {
    console.error('Error fetching programme settings:', settingsError)
    return []
  }
  if (!settings || settings.length === 0) return []

  // 2. Fetch inscription counts grouped by (session_id, type, programme)
  const sessionIds = [...new Set(settings.map(s => s.session_id))]
  const buildCountQuery = () => {
    let query = supabase
      .from('formation_inscriptions')
      .select('session_id, type, programme')
    if (sessionIds.length === 1) {
      query = query.eq('session_id', sessionIds[0])
    } else {
      query = query.in('session_id', sessionIds)
    }
    return query
  }

  const inscriptions = await paginatedFetch<{ session_id: string; type: string; programme: string }>(buildCountQuery)

  // 3. Count per (session_id, type, programme)
  const countMap: Record<string, number> = {}
  for (const ins of inscriptions) {
    const key = `${ins.session_id}|${ins.type}|${ins.programme}`
    countMap[key] = (countMap[key] || 0) + 1
  }

  // 4. Merge
  return settings.map(s => ({
    ...s,
    current_count: countMap[`${s.session_id}|${s.type}|${s.programme}`] || 0,
  })) as FormationProgrammeSettingWithCount[]
}

// ============================================
// CRUD: Programme settings
// ============================================

export async function upsertFormationProgrammeSetting(data: {
  session_id: string
  type: FormationType
  programme: string
  max_places: number
  salle?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_programme_settings')
    .upsert(
      {
        session_id: data.session_id,
        type: data.type,
        programme: data.programme,
        max_places: data.max_places,
        salle: data.salle || null,
      },
      { onConflict: 'session_id,type,programme' }
    )

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

export async function deleteFormationProgrammeSetting(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('formation_programme_settings').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}

// ============================================
// Toggle session registration open/closed
// ============================================

export async function toggleSessionRegistration(sessionId: string, open: boolean) {
  return updateFormationSession(sessionId, { registration_open: open })
}

// ============================================
// Self-registration (worker / formation_user)
// ============================================

export async function selfRegisterFormation(data: {
  session_id: string
  type: FormationType
  programme: string
  dpc?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Fetch profile with location
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, location_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable' }
  if (!['worker', 'formation_user'].includes(profile.role)) {
    return { error: 'Rôle non autorisé pour l\'inscription' }
  }

  // Determine statut from role
  const statut = profile.role === 'formation_user' ? 'Franchise' : 'Succursale'

  // Check session is active and registration is open
  const { data: session } = await supabase
    .from('formation_sessions')
    .select('id, is_active, registration_open')
    .eq('id', data.session_id)
    .single()

  if (!session) return { error: 'Session introuvable' }
  if (!session.is_active) return { error: 'Cette session n\'est plus active' }
  if (!session.registration_open) return { error: 'Les inscriptions sont fermées pour cette session' }

  // Check capacity
  const { data: setting } = await supabase
    .from('formation_programme_settings')
    .select('max_places')
    .eq('session_id', data.session_id)
    .eq('type', data.type)
    .eq('programme', data.programme)
    .single()

  if (!setting) return { error: 'Ce programme n\'est pas configuré pour cette session' }

  if (setting.max_places > 0) {
    // Count current inscriptions
    const { count } = await supabase
      .from('formation_inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', data.session_id)
      .eq('type', data.type)
      .eq('programme', data.programme)

    if (count !== null && count >= setting.max_places) {
      return { error: 'Ce programme est complet, plus de places disponibles' }
    }
  }

  // Get centre from location
  let centre: string | null = null
  if (profile.location_id) {
    const { data: location } = await supabase
      .from('locations')
      .select('name')
      .eq('id', profile.location_id)
      .single()
    centre = location?.name ?? null
  }

  // Insert via admin client (bypasses RLS)
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('formation_inscriptions')
    .insert({
      session_id: data.session_id,
      profile_id: user.id,
      nom: profile.last_name,
      prenom: profile.first_name,
      type: data.type,
      statut,
      programme: data.programme,
      centre,
      dpc: data.dpc ?? false,
    })

  if (error) {
    // Handle UNIQUE constraint violation
    if (error.code === '23505') {
      return { error: 'Vous êtes déjà inscrit à cette session pour ce type' }
    }
    return { error: error.message }
  }

  revalidatePath('/formations')
  return { success: true }
}

// ============================================
// Self-unregistration
// ============================================

export async function selfUnregisterFormation(inscriptionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Verify the inscription belongs to the user
  const adminClient = createAdminClient()
  const { data: inscription } = await adminClient
    .from('formation_inscriptions')
    .select('id, profile_id, session_id')
    .eq('id', inscriptionId)
    .single()

  if (!inscription) return { error: 'Inscription introuvable' }
  if (inscription.profile_id !== user.id) return { error: 'Non autorisé' }

  // Check session still has registration open
  const { data: session } = await supabase
    .from('formation_sessions')
    .select('registration_open')
    .eq('id', inscription.session_id)
    .single()

  if (!session?.registration_open) {
    return { error: 'Les inscriptions sont fermées, vous ne pouvez plus vous désinscrire' }
  }

  // Delete
  const { error } = await adminClient
    .from('formation_inscriptions')
    .delete()
    .eq('id', inscriptionId)

  if (error) return { error: error.message }
  revalidatePath('/formations')
  return { success: true }
}
