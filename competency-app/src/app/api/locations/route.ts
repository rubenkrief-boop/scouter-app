import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'
import { CreateLocationSchema, UpdateLocationSchema, UuidSchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

// GET - List all locations
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    logger.error('api.locations.list', error)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ locations })
}

// POST - Create location (admin only)
export async function POST(request: Request) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`locations-write:${ip}`, { maxRequests: 20, windowSeconds: 60 })
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

  const parsed = CreateLocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { name, address, city, postal_code } = parsed.data

  const adminClient = createAdminClient()

  const { data: location, error } = await adminClient
    .from('locations')
    .insert({ name, address, city, postal_code, is_active: true })
    .select()
    .single()

  if (error) {
    logger.error('api.locations.create', error)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ location })
}

// PATCH - Update location (admin only)
export async function PATCH(request: Request) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`locations-write:${ip}`, { maxRequests: 20, windowSeconds: 60 })
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

  const parsed = UpdateLocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const { locationId, ...rest } = parsed.data

  const updates: Record<string, unknown> = {}
  if (rest.name !== undefined) updates.name = rest.name
  if (rest.address !== undefined) updates.address = rest.address
  if (rest.city !== undefined) updates.city = rest.city
  if (rest.postal_code !== undefined) updates.postal_code = rest.postal_code
  if (rest.is_active !== undefined) updates.is_active = rest.is_active
  if (rest.zone_id !== undefined) updates.zone_id = rest.zone_id

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('locations')
    .update(updates)
    .eq('id', locationId)

  if (error) {
    logger.error('api.locations.update', error, { locationId })
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete location (admin only)
export async function DELETE(request: Request) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`locations-write:${ip}`, { maxRequests: 20, windowSeconds: 60 })
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

  const { searchParams } = new URL(request.url)
  const locationIdRaw = searchParams.get('id')

  const idParsed = UuidSchema.safeParse(locationIdRaw)
  if (!idParsed.success) {
    return NextResponse.json({ error: 'Location ID invalide' }, { status: 400 })
  }
  const locationId = idParsed.data

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('locations')
    .delete()
    .eq('id', locationId)

  if (error) {
    logger.error('api.locations.delete', error, { locationId })
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
