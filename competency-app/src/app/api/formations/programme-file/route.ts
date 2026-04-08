import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'
import {
  FormationProgrammeTypeEnum,
  PROGRAMME_FILE_MAX_SIZE_BYTES,
  PROGRAMME_FILE_MIME_TYPES,
  UuidSchema,
} from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES: readonly string[] = PROGRAMME_FILE_MIME_TYPES
const MAX_SIZE = PROGRAMME_FILE_MAX_SIZE_BYTES

// POST /api/formations/programme-file — Upload programme file
export async function POST(request: NextRequest) {
  // Rate limit: 10 uploads par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`prog-file-upload:${ip}`, { maxRequests: 10, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Authorization: admin/skill_master/manager only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'skill_master', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Parse form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const sessionIdRaw = formData.get('session_id')
  const typeRaw = formData.get('type')

  if (!file || typeof sessionIdRaw !== 'string' || typeof typeRaw !== 'string') {
    return NextResponse.json({ error: 'Paramètres manquants (file, session_id, type)' }, { status: 400 })
  }

  const sessionIdParsed = UuidSchema.safeParse(sessionIdRaw)
  if (!sessionIdParsed.success) {
    return NextResponse.json({ error: 'session_id invalide' }, { status: 400 })
  }
  const sessionId = sessionIdParsed.data

  const typeParsed = FormationProgrammeTypeEnum.safeParse(typeRaw)
  if (!typeParsed.success) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  const type = typeParsed.data

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Type de fichier non supporté. Formats acceptés : PNG, JPG, WebP, PDF, Excel.' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Le fichier est trop volumineux (max 10 Mo).' }, { status: 400 })
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `formation-programmes/${sessionId}_${type}.${ext}`

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  // Delete old files (different extensions)
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'xlsx', 'xls']
  const filesToRemove = extensions.map(e => `formation-programmes/${sessionId}_${type}.${e}`)

  const adminClient = createAdminClient()
  await adminClient.storage.from('company-assets').remove(filesToRemove)

  // Upload
  const { error: uploadError } = await adminClient.storage
    .from('company-assets')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    logger.error('api.formations.programmeFile.upload', uploadError, { sessionId, type })
    return NextResponse.json({ error: `Erreur upload: ${uploadError.message}` }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = adminClient.storage
    .from('company-assets')
    .getPublicUrl(storagePath)

  const fileUrl = urlData.publicUrl

  // Upsert in formation_programme_files
  const { error: dbError } = await adminClient
    .from('formation_programme_files')
    .upsert(
      {
        session_id: sessionId,
        type,
        file_url: fileUrl,
        file_name: file.name,
      },
      { onConflict: 'session_id,type' }
    )

  if (dbError) {
    logger.error('api.formations.programmeFile.dbUpsert', dbError, { sessionId, type })
    return NextResponse.json({ error: `Erreur base de données: ${dbError.message}` }, { status: 500 })
  }

  return NextResponse.json({ file_url: fileUrl, file_name: file.name })
}

// DELETE /api/formations/programme-file — Remove programme file
export async function DELETE(request: NextRequest) {
  // Rate limit: 10 suppressions par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`prog-file-delete:${ip}`, { maxRequests: 10, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

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

  if (!profile || !['super_admin', 'skill_master', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sessionIdRaw = searchParams.get('session_id')
  const typeRaw = searchParams.get('type')

  const sessionIdParsed = UuidSchema.safeParse(sessionIdRaw)
  if (!sessionIdParsed.success) {
    return NextResponse.json({ error: 'session_id invalide' }, { status: 400 })
  }
  const typeParsed = FormationProgrammeTypeEnum.safeParse(typeRaw)
  if (!typeParsed.success) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  const sessionId = sessionIdParsed.data
  const type = typeParsed.data

  const adminClient = createAdminClient()

  // Delete all possible file extensions
  const extensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'xlsx', 'xls']
  const filesToRemove = extensions.map(e => `formation-programmes/${sessionId}_${type}.${e}`)
  await adminClient.storage.from('company-assets').remove(filesToRemove)

  // Delete DB row
  await adminClient
    .from('formation_programme_files')
    .delete()
    .eq('session_id', sessionId)
    .eq('type', type)

  return NextResponse.json({ success: true })
}
