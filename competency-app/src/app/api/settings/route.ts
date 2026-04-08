import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'
import { UpdateSettingSchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

// GET /api/settings?key=chart_colors
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error) {
    return NextResponse.json({ value: null })
  }

  return NextResponse.json({ value: data.value })
}

// PUT /api/settings
export async function PUT(request: NextRequest) {
  // Rate limit: 20 updates par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`settings-update:${ip}`, { maxRequests: 20, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()

  // Check auth + role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'skill_master'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = UpdateSettingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { key, value } = parsed.data

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key, value, updated_by: user.id },
      { onConflict: 'key' }
    )

  if (error) {
    logger.error('api.settings.update', error, { key })
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
