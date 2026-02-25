import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

// POST /api/settings/logo — Upload company logo
export async function POST(request: NextRequest) {
  // Rate limit: 5 uploads par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`logo-upload:${ip}`, { maxRequests: 5, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()

  // Auth check
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

  // Parse form data
  const formData = await request.formData()
  const file = formData.get('logo') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non supporté. Utilisez PNG, JPG, SVG ou WebP.' }, { status: 400 })
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Le fichier est trop volumineux (max 2 Mo).' }, { status: 400 })
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'png'
  const fileName = `company-logo.${ext}`

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Upload to Supabase Storage (upsert)
  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('Logo upload error:', uploadError.message)
    return NextResponse.json({ error: `Erreur upload: ${uploadError.message}` }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('company-assets')
    .getPublicUrl(fileName)

  const logoUrl = urlData.publicUrl

  // Update app_settings with the logo URL (merge with existing branding)
  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'company_branding')
    .single()

  const currentBranding = (existing?.value as Record<string, unknown>) || {}

  const { error: settingsError } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'company_branding',
        value: { ...currentBranding, logoUrl },
        updated_by: user.id,
      },
      { onConflict: 'key' }
    )

  if (settingsError) {
    console.error('Settings update error:', settingsError.message)
    return NextResponse.json({ error: 'Logo uploadé mais erreur de sauvegarde des paramètres' }, { status: 500 })
  }

  return NextResponse.json({ logoUrl })
}

// DELETE /api/settings/logo — Remove company logo
export async function DELETE() {
  const supabase = await createClient()

  // Auth check
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

  // Try to delete all possible logo files
  const extensions = ['png', 'jpg', 'jpeg', 'svg', 'webp']
  for (const ext of extensions) {
    await supabase.storage.from('company-assets').remove([`company-logo.${ext}`])
  }

  // Update app_settings to remove logoUrl
  const { data: existing } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'company_branding')
    .single()

  const currentBranding = (existing?.value as Record<string, unknown>) || {}

  await supabase
    .from('app_settings')
    .upsert(
      {
        key: 'company_branding',
        value: { ...currentBranding, logoUrl: null },
        updated_by: user.id,
      },
      { onConflict: 'key' }
    )

  return NextResponse.json({ success: true })
}
