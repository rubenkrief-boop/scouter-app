'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/lib/audit'
import { LEGAL_VERSION } from '@/lib/legal'

/**
 * Server action appelee depuis la page /legal/accept quand l'utilisateur
 * coche "J'accepte" et clique Continuer. Marque le profil avec la
 * version courante des CGU + timestamp UTC + entree audit_logs.
 *
 * Idempotent : un re-accept ecrase l'horodatage precedent.
 */
export async function recordLegalAcceptance(): Promise<void> {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { error } = await admin
    .from('profiles')
    .update({
      legal_accepted_version: LEGAL_VERSION,
      legal_accepted_at: nowIso,
    })
    .eq('id', user.id)

  if (error) {
    logger.error('legal.acceptance.update_failed', error, { userId: user.id })
    throw new Error('Impossible d\'enregistrer votre acceptation. Reessayez.')
  }

  await recordAudit({
    action: 'user.legal_accepted',
    actorId: user.id,
    targetId: user.id,
    metadata: { version: LEGAL_VERSION, accepted_at: nowIso },
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
