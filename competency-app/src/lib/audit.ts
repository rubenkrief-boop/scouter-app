import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { redact } from '@/lib/utils-app/redact'

interface AuditLogParams {
  /** e.g. 'user.role_changed', 'user.deactivated', 'evaluation.deleted' */
  action: string
  /** auth.users.id de qui a fait l'action (null pour systeme/cron) */
  actorId: string | null
  /** auth.users.id ou autre UUID de la cible (when applicable) */
  targetId?: string | null
  /** Metadonnees libres. Redactees automatiquement avant insert. */
  metadata?: Record<string, unknown>
}

/**
 * Records a sensitive admin operation for later forensics.
 *
 * Never throws — un echec de logging ne doit JAMAIS bloquer l'action
 * metier sous-jacente. Si l'insert audit foire, on log l'erreur via
 * `logger` et on rend la main au caller.
 */
export async function recordAudit(params: AuditLogParams): Promise<void> {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for') || h.get('x-real-ip') || null
    const ua = h.get('user-agent') || null

    const supabaseAdmin = createAdminClient()
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      action: params.action,
      actor_id: params.actorId,
      target_id: params.targetId ?? null,
      metadata: params.metadata ? redact(params.metadata) : null,
      ip,
      user_agent: ua,
    })
    if (error) {
      logger.error('audit.insert_failed', error, { action: params.action })
    }
  } catch (err) {
    logger.error('audit.threw', err, { action: params.action })
  }
}
