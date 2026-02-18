import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - Create user (admin only)
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
  const { email, password, first_name, last_name, role, manager_id, location_id, job_title } = body

  const adminClient = createAdminClient()

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name, role },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update the profile with manager_id, location_id, and job_title if provided
  if (newUser?.user && (manager_id || location_id || job_title)) {
    await adminClient
      .from('profiles')
      .update({
        manager_id: manager_id || null,
        location_id: location_id || null,
        job_title: job_title || null,
      })
      .eq('id', newUser.user.id)
  }

  return NextResponse.json({ user: newUser })
}

// PATCH - Update user role/status (admin only)
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
  const { userId, role, job_title, manager_id, location_id, is_active } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Build update object explicitly to avoid passing unexpected fields
  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (job_title !== undefined) updates.job_title = job_title
  if (manager_id !== undefined) updates.manager_id = manager_id
  if (location_id !== undefined) updates.location_id = location_id
  if (is_active !== undefined) updates.is_active = is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await adminClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
