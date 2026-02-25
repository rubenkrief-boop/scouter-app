import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo

// POST /api/users/[id]/avatar — Upload avatar photo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  // Rate limit: 10 uploads par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`avatar-upload:${ip}`, { maxRequests: 10, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Authorization: super_admin, skill_master, manager (pour son equipe), ou le salarie lui-meme
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })
  }

  const isAdmin = ['super_admin', 'skill_master'].includes(profile.role)
  const isSelf = user.id === userId

  if (!isAdmin && !isSelf) {
    // Manager : verifier que le salarie est dans son equipe
    if (profile.role === 'manager') {
      const { data: teamMember } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('manager_id', user.id)
        .single()

      if (!teamMember) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
  }

  // Parse form data
  const formData = await request.formData()
  const file = formData.get('avatar') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non supporté. Utilisez PNG, JPG ou WebP.' }, { status: 400 })
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Le fichier est trop volumineux (max 2 Mo).' }, { status: 400 })
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `avatars/${userId}.${ext}`

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Upload to Supabase Storage (upsert)
  // First, delete old avatar files (different extensions)
  const extensions = ['png', 'jpg', 'jpeg', 'webp']
  const filesToRemove = extensions.map(e => `avatars/${userId}.${e}`)
  await supabase.storage.from('company-assets').remove(filesToRemove)

  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Avatar upload error:', uploadError.message)
    return NextResponse.json({ error: `Erreur upload: ${uploadError.message}` }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('company-assets')
    .getPublicUrl(fileName)

  const avatarUrl = urlData.publicUrl

  // Update profile with admin client (bypass RLS)
  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)

  if (updateError) {
    console.error('Profile update error:', updateError.message)
    return NextResponse.json({ error: 'Photo uploadée mais erreur de mise à jour du profil' }, { status: 500 })
  }

  return NextResponse.json({ avatarUrl })
}

// DELETE /api/users/[id]/avatar — Remove avatar photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Authorization
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })
  }

  const isAdmin = ['super_admin', 'skill_master'].includes(profile.role)
  const isSelf = user.id === userId

  if (!isAdmin && !isSelf) {
    if (profile.role === 'manager') {
      const { data: teamMember } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('manager_id', user.id)
        .single()

      if (!teamMember) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
  }

  // Delete all possible avatar files
  const extensions = ['png', 'jpg', 'jpeg', 'webp']
  const filesToRemove = extensions.map(e => `avatars/${userId}.${e}`)
  await supabase.storage.from('company-assets').remove(filesToRemove)

  // Update profile
  const adminClient = createAdminClient()
  await adminClient
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)

  return NextResponse.json({ success: true })
}
