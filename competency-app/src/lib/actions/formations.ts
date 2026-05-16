'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeName } from '@/lib/utils'
import type {
  FormationSession,
  FormationInscriptionWithSession,
  FormationAtelierWithSession,
  FormationProgrammeFile,
  FormationProgrammeSettingWithCount,
  FormationType,
} from '@/lib/types'
import type { UserRole } from '@/lib/types'

// ============================================
// Auth helper: require admin roles for mutations
// ============================================

const ADMIN_ROLES: UserRole[] = ['super_admin', 'skill_master', 'manager', 'resp_audiologie']

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
    logger.error('formations.getFormationSessions', error)
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
    logger.error('formations.getFormationAteliers', error)
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
      logger.error('formations.paginatedFetch', error)
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
    logger.error('formations.getWorkerFormations', error)
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
    logger.error('formations.getFormationProgrammeAteliers', error)
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
    logger.error('formations.getAllProgrammeAtelierMappings', error)
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
  } else if (!['super_admin', 'skill_master', 'resp_audiologie'].includes(profile.role)) {
    // Not authorized
    return []
  }

  const { data, error } = await query
  if (error) {
    logger.error('formations.getTeamProfiles', error)
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
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

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
  const auth = await requireFormationAdmin()
  if (auth.error) return { error: auth.error }

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

  // Only admin roles can create inscriptions
  if (!ADMIN_ROLES.includes(callerProfile.role as UserRole)) {
    return { error: 'Accès refusé' }
  }

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

  // Validate + normalize names
  if (!data.nom?.trim() || !data.prenom?.trim()) {
    return { error: 'Nom et prénom sont requis' }
  }
  if (data.nom.length > 100 || data.prenom.length > 100) {
    return { error: 'Nom ou prénom trop long (max 100 caractères)' }
  }
  const cleanNom = data.nom.trim().toUpperCase().replace(/<[^>]*>/g, '')
  const cleanPrenom = data.prenom.trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, c => c.toLowerCase()).replace(/<[^>]*>/g, '')

  const { error } = await supabase
    .from('formation_inscriptions')
    .insert({
      session_id: data.session_id,
      nom: cleanNom,
      prenom: cleanPrenom,
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

  // Validate name fields if provided
  if (data.nom !== undefined) {
    if (!data.nom?.trim() || data.nom.length > 100) return { error: 'Nom invalide (max 100 caractères)' }
    data.nom = data.nom.trim().toUpperCase().replace(/<[^>]*>/g, '')
  }
  if (data.prenom !== undefined) {
    if (!data.prenom?.trim() || data.prenom.length > 100) return { error: 'Prénom invalide (max 100 caractères)' }
    data.prenom = data.prenom.trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, c => c.toLowerCase()).replace(/<[^>]*>/g, '')
  }

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
    logger.error('formations.getFormationProgrammeFiles', error)
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
    logger.error('formations.getFormationProgrammeSettings', settingsError)
    return []
  }
  if (!settings || settings.length === 0) return []

  // 2. Fetch inscription counts grouped by (session_id, type, programme, statut)
  const sessionIds = [...new Set(settings.map(s => s.session_id))]
  const buildCountQuery = () => {
    let query = supabase
      .from('formation_inscriptions')
      .select('session_id, type, programme, statut')
    if (sessionIds.length === 1) {
      query = query.eq('session_id', sessionIds[0])
    } else {
      query = query.in('session_id', sessionIds)
    }
    return query
  }

  const inscriptions = await paginatedFetch<{ session_id: string; type: string; programme: string; statut: string }>(buildCountQuery)

  // 3. Count per (session_id, type, programme) — total + per statut
  const countMap: Record<string, number> = {}
  const countSuccMap: Record<string, number> = {}
  const countFranchiseMap: Record<string, number> = {}
  for (const ins of inscriptions) {
    const key = `${ins.session_id}|${ins.type}|${ins.programme}`
    countMap[key] = (countMap[key] || 0) + 1
    if (ins.statut === 'Succursale') {
      countSuccMap[key] = (countSuccMap[key] || 0) + 1
    } else if (ins.statut === 'Franchise') {
      countFranchiseMap[key] = (countFranchiseMap[key] || 0) + 1
    }
  }

  // 4. Merge
  return settings.map(s => {
    const key = `${s.session_id}|${s.type}|${s.programme}`
    return {
      ...s,
      current_count: countMap[key] || 0,
      current_count_succ: countSuccMap[key] || 0,
      current_count_franchise: countFranchiseMap[key] || 0,
    }
  }) as FormationProgrammeSettingWithCount[]
}

// ============================================
// CRUD: Programme settings
// ============================================

export async function upsertFormationProgrammeSetting(data: {
  session_id: string
  type: FormationType
  programme: string
  max_succ: number
  max_franchise: number
  salle?: string
}) {
  // Validate inputs
  if (!data.session_id || !data.type || !data.programme) {
    return { error: 'Session, type et programme sont requis' }
  }
  if (!['Audio', 'Assistante'].includes(data.type)) {
    return { error: 'Type invalide' }
  }
  if (data.max_succ < 0 || data.max_franchise < 0) {
    return { error: 'Le nombre de places ne peut pas être négatif' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('formation_programme_settings')
    .upsert(
      {
        session_id: data.session_id,
        type: data.type,
        programme: data.programme,
        max_succ: data.max_succ,
        max_franchise: data.max_franchise,
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

  // Fetch profile with location et statut
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, location_id, statut')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable' }
  // Auto-inscription autorisee pour worker (Succ), formation_user (Succ)
  // et gerant_franchise (le gerant peut s'inscrire LUI-MEME en plus
  // d'inscrire son equipe via enrollMyFranchiseTeam).
  if (!['worker', 'formation_user', 'gerant_franchise'].includes(profile.role)) {
    return { error: 'Rôle non autorisé pour l\'inscription' }
  }

  // Un salarié franchise (formation_user + statut=franchise) ne peut PAS
  // s'auto-inscrire ; c'est son gérant_franchise qui s'en charge via
  // enrollMyFranchiseTeam(). Cf decision produit 2026-05-15.
  const profileStatut = (profile as { statut?: string }).statut || 'succursale'
  if (profile.role === 'formation_user' && profileStatut === 'franchise') {
    return {
      error: "L'inscription est gérée par votre gérant franchisé. Contactez-le pour vous inscrire à cette formation.",
    }
  }

  // Determine statut from the new column (fallback au calcul historique
  // role-base pour les cas où la colonne aurait été oubliée).
  const statut = profileStatut === 'franchise' ? 'Franchise' : 'Succursale'

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
    .select('max_succ, max_franchise')
    .eq('session_id', data.session_id)
    .eq('type', data.type)
    .eq('programme', data.programme)
    .single()

  if (!setting) return { error: 'Ce programme n\'est pas configuré pour cette session' }

  // Check capacity based on statut
  const maxForStatut = statut === 'Franchise' ? setting.max_franchise : setting.max_succ

  if (maxForStatut > 0) {
    // Count current inscriptions for same statut only
    const { count } = await supabase
      .from('formation_inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', data.session_id)
      .eq('type', data.type)
      .eq('programme', data.programme)
      .eq('statut', statut)

    if (count !== null && count >= maxForStatut) {
      return { error: `Ce programme est complet pour les ${statut === 'Franchise' ? 'franchisés' : 'succursales'}, plus de places disponibles` }
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
    if (error.code === '23505') {
      return { error: 'Vous êtes déjà inscrit à cette session pour ce type' }
    }
    return { error: error.message }
  }

  // Re-check capacity after insert to handle race condition
  if (maxForStatut > 0) {
    const { count: postCount } = await adminClient
      .from('formation_inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', data.session_id)
      .eq('type', data.type)
      .eq('programme', data.programme)
      .eq('statut', statut)

    if (postCount !== null && postCount > maxForStatut) {
      // Rollback: delete the inscription we just created
      await adminClient
        .from('formation_inscriptions')
        .delete()
        .eq('session_id', data.session_id)
        .eq('profile_id', user.id)
        .eq('type', data.type)
        .eq('programme', data.programme)
      return { error: `Ce programme est complet pour les ${statut === 'Franchise' ? 'franchisés' : 'succursales'}, plus de places disponibles` }
    }
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

// ============================================
// Gérant franchisé — gestion de son équipe
// ============================================

export interface FranchiseTeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  job_title: string | null
  location_id: string | null
  location_name: string | null
  is_active: boolean
}

/**
 * Liste les salariés franchise dont le user courant est gérant via la
 * table centre_managers (N-à-N depuis migration 00031). Permet :
 *   - 1 gérant -> plusieurs centres (multi-centres) : voit tous les
 *     salariés des centres qu'il gère.
 *   - 1 centre -> plusieurs co-gérants : chaque co-gérant voit la même
 *     équipe.
 * N'expose que les profils statut=franchise pour éviter qu'un gérant
 * déraillé voie des workers succursale.
 */
export async function getMyFranchiseTeam(): Promise<FranchiseTeamMember[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // gerant_franchise OU manager (un manager succursale peut aussi avoir
  // des centres franchise affectes via centre_managers, ex: Sacha Binabout
  // qui gere 10 succursales + 3 franchises Compiegne/Coulommiers/Creteil).
  if (!profile || !['gerant_franchise', 'manager', 'super_admin'].includes(profile.role)) return []

  // Recup les centres dont l'utilisateur est gerant (table N-a-N).
  const { data: managed } = await supabase
    .from('centre_managers')
    .select('location_id')
    .eq('manager_id', user.id)
  const locationIds = (managed ?? []).map((m) => m.location_id)
  if (locationIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, job_title, location_id, is_active,
      location:locations!location_id(name)
    `)
    .in('location_id', locationIds)
    .eq('statut', 'franchise')
    .order('last_name', { ascending: true })

  if (error) {
    logger.error('formations.getMyFranchiseTeam', error)
    return []
  }

  return (data ?? []).map((row) => {
    const r = row as typeof row & { location?: { name: string } | { name: string }[] | null }
    const locField = r.location
    const locName =
      Array.isArray(locField) ? (locField[0]?.name ?? null)
      : locField && typeof locField === 'object' ? (locField as { name: string }).name
      : null
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      job_title: r.job_title,
      location_id: r.location_id,
      location_name: locName,
      is_active: r.is_active,
    }
  })
}

/**
 * Inscrit en lot les salariés sélectionnés à une session de formation.
 * Réservé au rôle gerant_franchise. Vérifie pour chaque profile_id :
 *   - manager_id = auth.uid() (le gérant ne peut inscrire QUE sa propre équipe)
 *   - statut = 'franchise'
 *   - capacité maxFranchise du programme pas dépassée (après insertion partielle)
 * Renvoie un détail par profil pour qu'on puisse afficher partiellement réussi.
 */
export async function enrollMyFranchiseTeam(params: {
  session_id: string
  type: FormationType
  programme: string
  profile_ids: string[]
  dpc?: boolean
}): Promise<{
  success: boolean
  error?: string
  results: Array<{ profile_id: string; ok: boolean; error?: string }>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié', results: [] }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['gerant_franchise', 'manager', 'super_admin'].includes(profile.role)) {
    return { success: false, error: 'Réservé aux gérants et managers', results: [] }
  }

  if (!params.profile_ids || params.profile_ids.length === 0) {
    return { success: false, error: 'Aucun salarié sélectionné', results: [] }
  }

  // Vérifs session
  const { data: session } = await supabase
    .from('formation_sessions')
    .select('id, is_active, registration_open')
    .eq('id', params.session_id)
    .single()
  if (!session) return { success: false, error: 'Session introuvable', results: [] }
  if (!session.is_active) return { success: false, error: "Session inactive", results: [] }
  if (!session.registration_open) return { success: false, error: 'Inscriptions fermées', results: [] }

  // Récup les centres geres par le user courant (validation : un salarie
  // n'est inscrible que si sa location_id appartient a ces centres).
  const { data: managed } = await supabase
    .from('centre_managers')
    .select('location_id')
    .eq('manager_id', user.id)
  const managedLocationIds = new Set((managed ?? []).map((m) => m.location_id))

  // Récup les profils ciblés (admin pour bypass RLS sur les autres profils)
  const adminClient = createAdminClient()
  const { data: targets } = await adminClient
    .from('profiles')
    .select('id, first_name, last_name, manager_id, statut, location_id')
    .in('id', params.profile_ids)

  // Récup le centre du gérant (pour passer le nom centre dans l'inscription).
  // On prend le centre du SALARIE en priorite, sinon celui du gérant.
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('location_id')
    .eq('id', user.id)
    .single()
  let myLocationName: string | null = null
  if (myProfile?.location_id) {
    const { data: loc } = await supabase
      .from('locations')
      .select('name')
      .eq('id', myProfile.location_id)
      .single()
    myLocationName = loc?.name ?? null
  }

  // Récup capa max franchise
  const { data: setting } = await supabase
    .from('formation_programme_settings')
    .select('max_franchise')
    .eq('session_id', params.session_id)
    .eq('type', params.type)
    .eq('programme', params.programme)
    .single()
  const maxFranchise = setting?.max_franchise ?? 0

  // Count actuel franchise
  const { count: currentCount } = await adminClient
    .from('formation_inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', params.session_id)
    .eq('type', params.type)
    .eq('programme', params.programme)
    .eq('statut', 'Franchise')

  const results: Array<{ profile_id: string; ok: boolean; error?: string }> = []
  let inserted = 0

  for (const pid of params.profile_ids) {
    const t = (targets ?? []).find((p) => p.id === pid)
    if (!t) {
      results.push({ profile_id: pid, ok: false, error: 'Profil introuvable' })
      continue
    }
    if (!t.location_id || !managedLocationIds.has(t.location_id)) {
      results.push({ profile_id: pid, ok: false, error: 'Ce salarié ne fait pas partie d\'un centre que vous gérez' })
      continue
    }
    if ((t as { statut?: string }).statut !== 'franchise') {
      results.push({ profile_id: pid, ok: false, error: 'Statut non franchise' })
      continue
    }
    // Capacité
    if (maxFranchise > 0 && (currentCount ?? 0) + inserted >= maxFranchise) {
      results.push({ profile_id: pid, ok: false, error: 'Programme complet pour les franchisés' })
      continue
    }

    // Récup centre du salarié si different du gerant
    let centre = myLocationName
    if (t.location_id) {
      const { data: tLoc } = await adminClient
        .from('locations')
        .select('name')
        .eq('id', t.location_id)
        .single()
      if (tLoc?.name) centre = tLoc.name
    }

    const { error: insErr } = await adminClient
      .from('formation_inscriptions')
      .insert({
        session_id: params.session_id,
        profile_id: pid,
        nom: t.last_name,
        prenom: t.first_name,
        type: params.type,
        statut: 'Franchise',
        programme: params.programme,
        centre,
        dpc: params.dpc ?? false,
      })

    if (insErr) {
      const msg = insErr.code === '23505'
        ? 'Déjà inscrit à cette session pour ce type'
        : insErr.message
      results.push({ profile_id: pid, ok: false, error: msg })
    } else {
      results.push({ profile_id: pid, ok: true })
      inserted++
    }
  }

  revalidatePath('/formations')
  return { success: inserted > 0, results }
}

// ============================================
// Vue gerant/manager : inscriptions de toute mon equipe
// ============================================

export interface TeamMemberInscription {
  id: string
  profile_id: string | null
  nom: string
  prenom: string
  session_id: string
  session_label: string | null
  session_code: string | null
  type: FormationType
  programme: string
  statut: string
  centre: string | null
  dpc: boolean
}

/**
 * Recupere toutes les inscriptions formation des membres d'equipe du
 * user courant (via centre_managers). Pour le dashboard gerant/manager
 * qui veut voir d'un coup d'oeil qui est inscrit a quoi.
 */
export async function getMyTeamInscriptions(): Promise<TeamMemberInscription[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Centres geres
  const { data: managed } = await supabase
    .from('centre_managers')
    .select('location_id')
    .eq('manager_id', user.id)
  const locationIds = (managed ?? []).map((m) => m.location_id)
  if (locationIds.length === 0) return []

  // Membres d'equipe (worker + formation_user des centres geres)
  const { data: members } = await supabase
    .from('profiles')
    .select('id')
    .in('location_id', locationIds)
    .in('role', ['worker', 'formation_user'])

  const memberIds = (members ?? []).map((m) => m.id)
  if (memberIds.length === 0) return []

  // Inscriptions de ces membres
  const { data: inscriptions } = await supabase
    .from('formation_inscriptions')
    .select(`
      id, profile_id, nom, prenom, session_id, type, programme, statut, centre, dpc,
      session:formation_sessions!session_id(label, code)
    `)
    .in('profile_id', memberIds)

  return ((inscriptions ?? []) as Array<{
    id: string
    profile_id: string | null
    nom: string
    prenom: string
    session_id: string
    type: string
    programme: string
    statut: string
    centre: string | null
    dpc: boolean
    session: { label: string; code: string } | { label: string; code: string }[] | null
  }>).map((row) => {
    const sess = Array.isArray(row.session) ? row.session[0] : row.session
    return {
      id: row.id,
      profile_id: row.profile_id,
      nom: row.nom,
      prenom: row.prenom,
      session_id: row.session_id,
      session_label: sess?.label ?? null,
      session_code: sess?.code ?? null,
      type: row.type as FormationType,
      programme: row.programme,
      statut: row.statut,
      centre: row.centre,
      dpc: row.dpc,
    }
  })
}

/**
 * Change le programme d'une inscription existante (P1 -> P2 par exemple).
 * Garde session_id, type, statut, dpc inchanges. Verifie scope via
 * centre_managers et capacite max du nouveau programme.
 */
export async function changeMyTeamMemberProgramme(params: {
  inscription_id: string
  new_programme: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['gerant_franchise', 'manager', 'super_admin', 'skill_master'].includes(profile.role)) {
    return { ok: false, error: 'Reservé aux gérants/managers' }
  }

  const adminClient = createAdminClient()
  const { data: insc } = await adminClient
    .from('formation_inscriptions')
    .select('id, profile_id, session_id, type, statut, programme, centre, dpc, nom, prenom')
    .eq('id', params.inscription_id)
    .single()
  if (!insc) return { ok: false, error: 'Inscription introuvable' }
  if (insc.programme === params.new_programme) {
    return { ok: false, error: 'Programme inchangé' }
  }

  // Verif scope
  if (insc.profile_id) {
    const { data: target } = await adminClient
      .from('profiles')
      .select('location_id')
      .eq('id', insc.profile_id)
      .single()
    if (!target?.location_id) return { ok: false, error: 'Salarié sans centre' }
    const { data: managed } = await supabase
      .from('centre_managers')
      .select('location_id')
      .eq('manager_id', user.id)
      .eq('location_id', target.location_id)
    if (!managed || managed.length === 0) {
      return { ok: false, error: 'Ce salarié ne fait pas partie de vos centres' }
    }
  }

  // Verif capacite du nouveau programme
  const { data: setting } = await adminClient
    .from('formation_programme_settings')
    .select('max_succ, max_franchise')
    .eq('session_id', insc.session_id)
    .eq('type', insc.type)
    .eq('programme', params.new_programme)
    .single()
  if (!setting) {
    return { ok: false, error: 'Programme cible introuvable pour cette session' }
  }
  const maxCol = insc.statut === 'Succursale' ? 'max_succ' : 'max_franchise'
  const maxVal = (setting as Record<string, number>)[maxCol] ?? 0
  if (maxVal > 0) {
    const { count: currentCount } = await adminClient
      .from('formation_inscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', insc.session_id)
      .eq('type', insc.type)
      .eq('programme', params.new_programme)
      .eq('statut', insc.statut)
    if ((currentCount ?? 0) >= maxVal) {
      return { ok: false, error: `Capacité ${insc.statut.toLowerCase()} atteinte pour ${params.new_programme}` }
    }
  }

  // UPDATE programme (plus simple qu'un DELETE+INSERT qui aurait des
  // effets de bord sur les FK d'audit eventuelles).
  const { error } = await adminClient
    .from('formation_inscriptions')
    .update({ programme: params.new_programme, updated_at: new Date().toISOString() })
    .eq('id', params.inscription_id)
  if (error) {
    logger.error('formations.changeMyTeamMemberProgramme', error, { inscriptionId: params.inscription_id, new_programme: params.new_programme })
    return { ok: false, error: error.message }
  }

  revalidatePath('/formations')
  return { ok: true }
}

/**
 * Desinscrit un membre d'equipe d'une inscription. Verifie que le user
 * courant gere bien le centre du membre vise. Reservation aux roles
 * gerant_franchise/manager/admin.
 */
export async function unenrollMyTeamMember(params: {
  inscription_id: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['gerant_franchise', 'manager', 'super_admin', 'skill_master'].includes(profile.role)) {
    return { ok: false, error: 'Reservé aux gérants/managers' }
  }

  const adminClient = createAdminClient()
  // Recupere l'inscription + son profil cible
  const { data: insc } = await adminClient
    .from('formation_inscriptions')
    .select('id, profile_id')
    .eq('id', params.inscription_id)
    .single()
  if (!insc) return { ok: false, error: 'Inscription introuvable' }

  if (insc.profile_id) {
    // Verifie que le user courant gere le centre du membre cible
    const { data: target } = await adminClient
      .from('profiles')
      .select('location_id')
      .eq('id', insc.profile_id)
      .single()
    if (!target?.location_id) {
      return { ok: false, error: 'Salarié sans centre' }
    }
    const { data: managed } = await supabase
      .from('centre_managers')
      .select('location_id')
      .eq('manager_id', user.id)
      .eq('location_id', target.location_id)
    if (!managed || managed.length === 0) {
      return { ok: false, error: 'Ce salarié ne fait pas partie de vos centres' }
    }
  }

  const { error } = await adminClient
    .from('formation_inscriptions')
    .delete()
    .eq('id', params.inscription_id)
  if (error) {
    logger.error('formations.unenrollMyTeamMember', error, { inscriptionId: params.inscription_id })
    return { ok: false, error: error.message }
  }

  revalidatePath('/formations')
  return { ok: true }
}

// ============================================
// Manager succursale — gestion de son équipe worker
// ============================================

/**
 * Liste les workers (role='worker', statut='succursale') des centres geres
 * par le user courant via la table centre_managers. Symetrique de
 * getMyFranchiseTeam mais pour le cote succursale.
 *   - 1 manager -> plusieurs centres : voit tous ses workers
 *   - 1 centre -> plusieurs co-managers : meme equipe pour chacun
 */
export async function getMyWorkerTeam(): Promise<FranchiseTeamMember[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Seuls les rôles avec autorité sur des centres peuvent inscrire des workers.
  if (!profile || !['manager', 'super_admin', 'skill_master'].includes(profile.role)) return []

  const { data: managed } = await supabase
    .from('centre_managers')
    .select('location_id')
    .eq('manager_id', user.id)
  const locationIds = (managed ?? []).map((m) => m.location_id)
  if (locationIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, job_title, location_id, is_active,
      location:locations!location_id(name)
    `)
    .in('location_id', locationIds)
    .eq('role', 'worker')
    .eq('statut', 'succursale')
    .order('last_name', { ascending: true })

  if (error) {
    logger.error('formations.getMyWorkerTeam', error)
    return []
  }

  return (data ?? []).map((row) => {
    const r = row as typeof row & { location?: { name: string } | { name: string }[] | null }
    const locField = r.location
    const locName =
      Array.isArray(locField) ? (locField[0]?.name ?? null)
      : locField && typeof locField === 'object' ? (locField as { name: string }).name
      : null
    return {
      id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      job_title: r.job_title,
      location_id: r.location_id,
      location_name: locName,
      is_active: r.is_active,
    }
  })
}

/**
 * Inscrit en lot les workers selectionnes (statut Succursale) a une session.
 * Symetrique de enrollMyFranchiseTeam. Verifs :
 *   - role = 'worker' AND statut = 'succursale'
 *   - location_id du worker ∈ centres geres par le user (centre_managers)
 *   - capacite max_succursale du programme
 */
export async function enrollMyWorkerTeam(params: {
  session_id: string
  type: FormationType
  programme: string
  profile_ids: string[]
  dpc?: boolean
}): Promise<{
  success: boolean
  error?: string
  results: Array<{ profile_id: string; ok: boolean; error?: string }>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié', results: [] }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['manager', 'super_admin', 'skill_master'].includes(profile.role)) {
    return { success: false, error: 'Réservé aux managers / admins', results: [] }
  }

  if (!params.profile_ids || params.profile_ids.length === 0) {
    return { success: false, error: 'Aucun salarié sélectionné', results: [] }
  }

  // Vérifs session
  const { data: session } = await supabase
    .from('formation_sessions')
    .select('id, is_active, registration_open')
    .eq('id', params.session_id)
    .single()
  if (!session) return { success: false, error: 'Session introuvable', results: [] }
  if (!session.is_active) return { success: false, error: 'Session inactive', results: [] }
  if (!session.registration_open) return { success: false, error: 'Inscriptions fermées', results: [] }

  const { data: managed } = await supabase
    .from('centre_managers')
    .select('location_id')
    .eq('manager_id', user.id)
  const managedLocationIds = new Set((managed ?? []).map((m) => m.location_id))

  const adminClient = createAdminClient()
  const { data: targets } = await adminClient
    .from('profiles')
    .select('id, first_name, last_name, role, statut, location_id')
    .in('id', params.profile_ids)

  // Capa max succursale
  const { data: setting } = await supabase
    .from('formation_programme_settings')
    .select('max_succursale')
    .eq('session_id', params.session_id)
    .eq('type', params.type)
    .eq('programme', params.programme)
    .single()
  const maxSucc = (setting as { max_succursale?: number } | null)?.max_succursale ?? 0

  // Count actuel succursale
  const { count: currentCount } = await adminClient
    .from('formation_inscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', params.session_id)
    .eq('type', params.type)
    .eq('programme', params.programme)
    .eq('statut', 'Succursale')

  const results: Array<{ profile_id: string; ok: boolean; error?: string }> = []
  let inserted = 0

  for (const pid of params.profile_ids) {
    const t = (targets ?? []).find((p) => p.id === pid)
    if (!t) {
      results.push({ profile_id: pid, ok: false, error: 'Profil introuvable' })
      continue
    }
    if (!t.location_id || !managedLocationIds.has(t.location_id)) {
      results.push({ profile_id: pid, ok: false, error: 'Worker hors de vos centres' })
      continue
    }
    if (t.role !== 'worker' || (t as { statut?: string }).statut !== 'succursale') {
      results.push({ profile_id: pid, ok: false, error: 'Doit être un worker succursale' })
      continue
    }
    if (maxSucc > 0 && (currentCount ?? 0) + inserted >= maxSucc) {
      results.push({ profile_id: pid, ok: false, error: 'Programme complet (succursale)' })
      continue
    }

    let centre: string | null = null
    if (t.location_id) {
      const { data: tLoc } = await adminClient
        .from('locations')
        .select('name')
        .eq('id', t.location_id)
        .single()
      if (tLoc?.name) centre = tLoc.name
    }

    const { error: insErr } = await adminClient
      .from('formation_inscriptions')
      .insert({
        session_id: params.session_id,
        profile_id: pid,
        nom: t.last_name,
        prenom: t.first_name,
        type: params.type,
        statut: 'Succursale',
        programme: params.programme,
        centre,
        dpc: params.dpc ?? false,
      })

    if (insErr) {
      const msg = insErr.code === '23505'
        ? 'Déjà inscrit à cette session pour ce type'
        : insErr.message
      results.push({ profile_id: pid, ok: false, error: msg })
    } else {
      results.push({ profile_id: pid, ok: true })
      inserted++
    }
  }

  revalidatePath('/formations')
  return { success: inserted > 0, results }
}
