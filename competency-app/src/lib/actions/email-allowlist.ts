'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/lib/audit'

export interface AllowlistRow {
  email: string
  is_active: boolean
  notes: string | null
  added_by: string | null
  added_at: string
  deactivated_at: string | null
}

// Domaines Vivason actuellement autorises par la couche 1 (auth callback).
// La couche 2 (allowlist) ne sert qu'a filtrer plus finement A L'INTERIEUR
// de ces domaines.
const ALLOWED_DOMAINS = ['vivason.fr', 'vivason.ma']

async function requireSuperAdmin() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) return { ok: false as const, error: 'Non authentifie' }
  if (profile.role !== 'super_admin') return { ok: false as const, error: 'Acces non autorise' }
  return { ok: true as const, user, profile }
}

export async function getAllowlist(): Promise<AllowlistRow[]> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return []

  // On utilise le service role parce que la RLS de email_allowlist
  // restreint les SELECT a super_admin uniquement ; ici on a deja
  // verifie le role cote app, le service role bypass la RLS
  // proprement.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_allowlist')
    .select('*')
    .order('is_active', { ascending: false })
    .order('added_at', { ascending: false })

  if (error) {
    logger.error('allowlist.fetch_failed', error)
    return []
  }
  return (data ?? []) as AllowlistRow[]
}

const addSchema = z.object({
  email: z.string().email('Email invalide').transform(s => s.toLowerCase().trim()),
  notes: z.string().max(500).optional().nullable(),
})

export async function addToAllowlist(formData: {
  email: string
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  const parsed = addSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Donnees invalides' }
  }

  // Defense en profondeur : meme si l'enforcement au login est desactive,
  // on refuse d'ajouter un email hors des domaines autorises pour ne pas
  // polluer la table avec des donnees qui n'auront jamais d'effet.
  const domain = parsed.data.email.split('@').pop() ?? ''
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return {
      success: false,
      error: `Seuls les emails @${ALLOWED_DOMAINS.join(' ou @')} sont autorises`,
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('email_allowlist')
    .upsert(
      {
        email: parsed.data.email,
        is_active: true,
        notes: parsed.data.notes ?? null,
        added_by: auth.user.id,
        deactivated_at: null,
      },
      { onConflict: 'email' },
    )

  if (error) {
    logger.error('allowlist.add_failed', error, { email: parsed.data.email })
    return { success: false, error: 'Erreur lors de l\'ajout' }
  }

  await recordAudit({
    action: 'allowlist.email_added',
    actorId: auth.user.id,
    metadata: { email: parsed.data.email },
  })

  revalidatePath('/admin/email-allowlist')
  return { success: true }
}

export async function setAllowlistActive(
  email: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return { success: false, error: auth.error }

  // Anti-lockout : empecher un super_admin de se desactiver lui-meme.
  if (!isActive && email.toLowerCase() === (auth.user.email ?? '').toLowerCase()) {
    return {
      success: false,
      error: 'Vous ne pouvez pas desactiver votre propre email.',
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('email_allowlist')
    .update({
      is_active: isActive,
      deactivated_at: isActive ? null : new Date().toISOString(),
    })
    .eq('email', email.toLowerCase())

  if (error) {
    logger.error('allowlist.toggle_failed', error, { email })
    return { success: false, error: 'Erreur lors de la mise a jour' }
  }

  await recordAudit({
    action: isActive ? 'allowlist.email_reactivated' : 'allowlist.email_deactivated',
    actorId: auth.user.id,
    metadata: { email },
  })

  revalidatePath('/admin/email-allowlist')
  return { success: true }
}
