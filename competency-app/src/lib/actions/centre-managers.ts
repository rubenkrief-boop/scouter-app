'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

export interface CentreManagerRow {
  manager_id: string
  location_id: string
  is_primary: boolean
  manager_name: string
  manager_email: string
  manager_role: string
  location_name: string
}

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Non authentifié' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return { ok: false as const, error: 'Réservé aux administrateurs' }
  }
  return { ok: true as const, userId: user.id }
}

/**
 * Liste tous les couples (gerant/centre) avec les libelles joints.
 * Accessible aux super_admin uniquement pour la page de gestion.
 */
export async function listCentreManagers(): Promise<CentreManagerRow[]> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('centre_managers')
    .select(`
      manager_id, location_id, is_primary,
      manager:profiles!manager_id(first_name, last_name, email, role),
      location:locations!location_id(name)
    `)
    .order('location_id')

  if (error) {
    logger.error('centre-managers.list', error)
    return []
  }

  return (data ?? []).map((row) => {
    const r = row as typeof row & {
      manager: { first_name: string; last_name: string; email: string; role: string } | { first_name: string; last_name: string; email: string; role: string }[] | null
      location: { name: string } | { name: string }[] | null
    }
    const mgr = Array.isArray(r.manager) ? r.manager[0] : r.manager
    const loc = Array.isArray(r.location) ? r.location[0] : r.location
    return {
      manager_id: r.manager_id,
      location_id: r.location_id,
      is_primary: r.is_primary,
      manager_name: mgr ? `${mgr.first_name} ${mgr.last_name}` : '—',
      manager_email: mgr?.email ?? '—',
      manager_role: mgr?.role ?? '—',
      location_name: loc?.name ?? '—',
    }
  })
}

/**
 * Ajoute (ou met a jour) un couple gerant/centre. Idempotent grace au PK
 * compose (manager_id, location_id).
 */
export async function addCentreManager(params: {
  manager_id: string
  location_id: string
  is_primary?: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('centre_managers')
    .upsert({
      manager_id: params.manager_id,
      location_id: params.location_id,
      is_primary: params.is_primary ?? false,
      created_by: guard.userId,
    }, { onConflict: 'manager_id,location_id' })

  if (error) {
    logger.error('centre-managers.add', error, { params })
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/centre-managers')
  return { ok: true }
}

/**
 * Supprime un couple gerant/centre. Idempotent.
 */
export async function removeCentreManager(params: {
  manager_id: string
  location_id: string
}): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return { ok: false, error: guard.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('centre_managers')
    .delete()
    .eq('manager_id', params.manager_id)
    .eq('location_id', params.location_id)

  if (error) {
    logger.error('centre-managers.remove', error, { params })
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/centre-managers')
  return { ok: true }
}
