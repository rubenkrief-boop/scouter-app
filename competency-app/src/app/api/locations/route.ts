import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    console.error('Locations API error:', error.message)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ locations })
}

// POST - Create location (admin only)
export async function POST(request: Request) {
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

  const body = await request.json()
  const { name, address, city, postal_code } = body

  const adminClient = createAdminClient()

  const { data: location, error } = await adminClient
    .from('locations')
    .insert({ name, address, city, postal_code, is_active: true })
    .select()
    .single()

  if (error) {
    console.error('Locations API error:', error.message)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ location })
}

// PATCH - Update location (admin only)
export async function PATCH(request: Request) {
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

  const body = await request.json()
  const { locationId, ...updates } = body

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('locations')
    .update(updates)
    .eq('id', locationId)

  if (error) {
    console.error('Locations API error:', error.message)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// DELETE - Delete location (admin only)
export async function DELETE(request: Request) {
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
  const locationId = searchParams.get('id')

  if (!locationId) {
    return NextResponse.json({ error: 'Location ID required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('locations')
    .delete()
    .eq('id', locationId)

  if (error) {
    console.error('Locations API error:', error.message)
    return NextResponse.json({ error: 'Erreur lors de l\'opération' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
