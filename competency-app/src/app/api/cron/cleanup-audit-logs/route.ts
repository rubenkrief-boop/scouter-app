import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// Politique de retention (politique de confidentialite Scouter) :
// les logs applicatifs sont conserves 1 an. Cette cron purge les entrees
// audit_logs vieilles de plus de 365 jours.
//
// Cron schedule (cf. vercel.json) : tous les jours a 04h00 UTC.
const RETENTION_DAYS = 365

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    logger.error('cron.cleanup_audit_logs.misconfigured', 'CRON_SECRET non configure')
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!safeCompare(authHeader, expected)) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    logger.warn('cron.cleanup_audit_logs.unauthorized', 'wrong CRON_SECRET', { ip })
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffIso = cutoff.toISOString()

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('audit_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffIso)

  if (error) {
    logger.error('cron.cleanup_audit_logs.delete_failed', error)
    return NextResponse.json({ error: 'Echec suppression' }, { status: 500 })
  }

  logger.info('cron.cleanup_audit_logs.success', 'purge terminee', {
    deleted: count ?? 0,
    cutoff: cutoffIso,
    retention_days: RETENTION_DAYS,
  })

  return NextResponse.json({
    success: true,
    deleted: count ?? 0,
    cutoff: cutoffIso,
    retention_days: RETENTION_DAYS,
  })
}
