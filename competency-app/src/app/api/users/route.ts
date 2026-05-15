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
  const {
    userId, role, manager_id, location_id, is_active,
    first_name, last_name, job_title, job_profile_id, statut, email,
  } = parsed.data

  const adminClient = createAdminClient()

  // Anti-lockout : un super_admin ne peut pas se rétrograder lui-même
  // ni se désactiver. Garde-fou contre un clic accidentel ou un compte
  // compromis qui tenterait de bloquer toute administration.
  if (userId === user.id) {
    if (role !== undefined && role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous rétrograder vous-même.' },
        { status: 400 },
      )
    }
    if (is_active === false) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas désactiver votre propre compte.' },
        { status: 400 },
      )
    }
  }

  // Build update object explicitly to avoid passing unexpected fields
  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (manager_id !== undefined) updates.manager_id = manager_id
  if (location_id !== undefined) updates.location_id = location_id
  if (is_active !== undefined) updates.is_active = is_active
  if (first_name !== undefined) updates.first_name = first_name
  if (last_name !== undefined) updates.last_name = last_name
  if (job_title !== undefined) updates.job_title = job_title
  if (job_profile_id !== undefined) updates.job_profile_id = job_profile_id
  if (statut !== undefined) updates.statut = statut

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      logger.error('api.users.update', error, { userId })
      return NextResponse.json({ error: `Impossible de mettre à jour: ${error.message}` }, { status: 400 })
    }
  }

  // Email change : ça touche auth.users en plus de profiles. On le fait
  // après le reste pour ne pas bloquer un update simple si la sync
  // auth.email échoue.
  if (email !== undefined) {
    const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    })
    if (authErr) {
      logger.error('api.users.update_email', authErr, { userId })
      return NextResponse.json(
        { error: `Email partiel : profil mis à jour mais auth refuse l'email (${authErr.message})` },
        { status: 400 },
      )
    }
    // Sync l'email dans profiles aussi (sans cascade auto en place).
    const { error: profEmailErr } = await adminClient
      .from('profiles')
      .update({ email })
      .eq('id', userId)
    if (profEmailErr) {
      logger.error('api.users.update_email_profile', profEmailErr, { userId })
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE - Suppression DEFINITIVE d'un user (admin only)
// Effets :
//   - auth.users supprime (cascade -> profiles via FK ON DELETE CASCADE)
//   - formation_inscriptions.profile_id passe a NULL (ON DELETE SET NULL)
//   - evaluations / worker_comments avec ce user comme audio/évaluateur :
//     comportement determine par les FKs (a verifier au cas par cas).
// Anti-lockout : le super_admin ne peut pas se supprimer lui-meme.
export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`users-delete:${ip}`, { maxRequests: 10, windowSeconds: 60 })
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

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ error: 'userId requis' }, { status: 400 })
  }

  if (body.userId === user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas supprimer votre propre compte.' },
      { status: 400 },
    )
  }

  const adminClient = createAdminClient()

  // Supprimer via l'admin auth API. ON DELETE CASCADE sur profiles fera
  // la cascade. Les FKs des autres tables (formation_inscriptions,
  // evaluations, etc.) ont leurs propres regles ON DELETE.
  const { error } = await adminClient.auth.admin.deleteUser(body.userId)

  if (error) {
    logger.error('api.users.delete', error, { userId: body.userId })
    return NextResponse.json(
      { error: `Impossible de supprimer: ${error.message}` },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true })
}
