import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'
import { CreateUserSchema, UpdateUserSchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

// POST - Create user (admin only)
export async function POST(request: Request) {
  // Rate limit: 10 créations par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`users-create:${ip}`, { maxRequests: 10, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { email, password, first_name, last_name, role, manager_id, location_id } = parsed.data

  const adminClient = createAdminClient()

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name, role },
  })

  if (error) {
    logger.error('api.users.create', error, { email })
    return NextResponse.json({ error: `Impossible de créer cet utilisateur: ${error.message}` }, { status: 400 })
  }

  // Update the profile with manager_id and location_id if provided
  if (newUser?.user && (manager_id || location_id)) {
    const { error: updErr } = await adminClient
      .from('profiles')
      .update({
        manager_id: manager_id || null,
        location_id: location_id || null,
      })
      .eq('id', newUser.user.id)
    if (updErr) {
      logger.error('api.users.create', updErr, { userId: newUser.user.id, step: 'profile-update' })
    }
  }

  return NextResponse.json({ user: newUser })
}

// PATCH - Update user role/status (admin only)
export async function PATCH(request: Request) {
  // Rate limit: 30 updates par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`users-update:${ip}`, { maxRequests: 30, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { userId, role, manager_id, location_id, is_active } = parsed.data

  const adminClient = createAdminClient()

  // Build update object explicitly to avoid passing unexpected fields
  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (manager_id !== undefined) updates.manager_id = manager_id
  if (location_id !== undefined) updates.location_id = location_id
  if (is_active !== undefined) updates.is_active = is_active

  const { error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    logger.error('api.users.update', error, { userId })
    return NextResponse.json({ error: `Impossible de mettre à jour: ${error.message}` }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
