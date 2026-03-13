'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  FormationSession,
  FormationAtelier,
  FormationInscription,
  FormationInscriptionWithSession,
  FormationAtelierWithSession,
} from '@/lib/types'

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
      query = query.or(`nom.ilike.%${filters.search}%,prenom.ilike.%${filters.search}%,centre.ilike.%${filters.search}%`)
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
}) {
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

  // Normalize for matching
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '')

  let linked = 0
  for (const insc of inscriptions) {
    const key = normalize(insc.prenom) + normalize(insc.nom)
    const match = profiles.find(p =>
      normalize(p.first_name) + normalize(p.last_name) === key
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
