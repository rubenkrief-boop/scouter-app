import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'

// POST - Assign a job profile to a worker
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params
  const ip = getClientIp(request)
  const rl = checkRateLimit(`worker-jp-add:${ip}`, { maxRequests: 20, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role: super_admin, skill_master, or manager
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { jobProfileId } = await request.json()
  if (!jobProfileId) {
    return NextResponse.json({ error: 'jobProfileId is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Insert assignment (unique constraint prevents duplicates)
  const { error } = await adminClient
    .from('audioprothesiste_assignments')
    .insert({
      audioprothesiste_id: workerId,
      job_profile_id: jobProfileId,
    })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce profil métier est déjà attribué' }, { status: 409 })
    }
    console.error('Assign job profile error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Also update job_title on profiles for display purposes
  const { data: jp } = await adminClient
    .from('job_profiles')
    .select('name')
    .eq('id', jobProfileId)
    .single()

  if (jp) {
    // Set job_title to the latest assigned profile name
    await adminClient
      .from('profiles')
      .update({ job_title: jp.name })
      .eq('id', workerId)
  }

  return NextResponse.json({ success: true })
}

// DELETE - Remove a job profile from a worker
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workerId } = await params
  const ip = getClientIp(request)
  const rl = checkRateLimit(`worker-jp-del:${ip}`, { maxRequests: 20, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { jobProfileId } = await request.json()
  if (!jobProfileId) {
    return NextResponse.json({ error: 'jobProfileId is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('audioprothesiste_assignments')
    .delete()
    .eq('audioprothesiste_id', workerId)
    .eq('job_profile_id', jobProfileId)

  if (error) {
    console.error('Remove job profile error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update job_title: use the remaining first assignment, or null
  const { data: remaining } = await adminClient
    .from('audioprothesiste_assignments')
    .select('job_profile_id, job_profile:job_profiles(name)')
    .eq('audioprothesiste_id', workerId)
    .limit(1)
    .single()

  await adminClient
    .from('profiles')
    .update({ job_title: (remaining?.job_profile as any)?.name ?? null })
    .eq('id', workerId)

  return NextResponse.json({ success: true })
}
