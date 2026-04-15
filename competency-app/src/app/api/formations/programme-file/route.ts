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
import * as XLSX from 'xlsx'

const ALLOWED_TYPES: readonly string[] = PROGRAMME_FILE_MIME_TYPES
const MAX_SIZE = PROGRAMME_FILE_MAX_SIZE_BYTES

// Known programme column names
const PROGRAMME_COLUMNS = ['P1', 'P2', 'P3', 'P4', 'Format rotatif']

/**
 * Parse an Excel file to extract programme-atelier mappings.
 * Expected format (Option B): columns named P1, P2, P3, P4
 * Each column contains atelier names in rows.
 */
function parseExcelProgrammes(buffer: Uint8Array): Record<string, string[]> {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return {}

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

  if (jsonData.length === 0) return {}

  // Detect programme columns (case-insensitive match)
  const headers = Object.keys(jsonData[0])
  const columnMap: Record<string, string> = {} // normalized -> original header

  for (const header of headers) {
    const normalized = header.trim().toUpperCase()
    for (const prog of PROGRAMME_COLUMNS) {
      if (normalized === prog.toUpperCase()) {
        columnMap[prog] = header
      }
    }
  }

  if (Object.keys(columnMap).length === 0) return {}

  // Extract atelier names per programme
  const result: Record<string, string[]> = {}

  for (const [progName, colHeader] of Object.entries(columnMap)) {
    const ateliers: string[] = []
    for (const row of jsonData) {
      const val = (row[colHeader] || '').toString().trim()
      if (val) {
        ateliers.push(val)
      }
    }
    if (ateliers.length > 0) {
      result[progName] = ateliers
    }
  }

  return result
}

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

  // ============================================
  // Excel: auto-parse programme-atelier mappings
  // ============================================
  const isExcel = ext === 'xlsx' || ext === 'xls'
  let importedProgrammes: string[] = []

  if (isExcel) {
    try {
      const programmeAteliers = parseExcelProgrammes(buffer)
      const programmeNames = Object.keys(programmeAteliers)

      if (programmeNames.length > 0) {
        // 1. Fetch ateliers for THIS session + type for name matching
        const { data: allAteliers } = await adminClient
          .from('formation_ateliers')
          .select('id, nom, sort_order')
          .eq('session_id', sessionId)
          .eq('type', type)

        const atelierMap = new Map<string, string>() // lowercase name -> id
        for (const a of allAteliers || []) {
          atelierMap.set(a.nom.toLowerCase().trim(), a.id)
        }

        // Collect all unique atelier names from Excel to auto-create missing ones
        const allAtelierNames = new Set<string>()
        for (const names of Object.values(programmeAteliers)) {
          for (const name of names) allAtelierNames.add(name.trim())
        }

        // Auto-create ateliers that don't exist yet in this session
        const existingSortOrders = (allAteliers || []).map(a => a.sort_order ?? 0)
        let nextSortOrder = existingSortOrders.length > 0 ? Math.max(...existingSortOrders) + 1 : 0
        const createdAteliers: string[] = []

        for (const name of allAtelierNames) {
          if (atelierMap.has(name.toLowerCase())) continue

          // Determine which programmes this atelier belongs to
          const progs: string[] = []
          for (const [programme, names] of Object.entries(programmeAteliers)) {
            if (names.some(n => n.trim().toLowerCase() === name.toLowerCase())) {
              progs.push(programme)
            }
          }

          const { data: newAtelier, error: createErr } = await adminClient
            .from('formation_ateliers')
            .insert({
              session_id: sessionId,
              nom: name,
              type,
              etat: 'Pas commencé',
              sort_order: nextSortOrder++,
              programmes: progs.join(', ') || null,
              formateur: null,
              duree: null,
            })
            .select('id')
            .single()

          if (!createErr && newAtelier) {
            atelierMap.set(name.toLowerCase(), newAtelier.id)
            createdAteliers.push(name)
          } else {
            logger.error('api.formations.programmeFile.createAtelier', createErr, { name })
          }
        }

        // 2. Delete old mappings for this session/type
        await adminClient
          .from('formation_programme_ateliers')
          .delete()
          .eq('session_id', sessionId)
          .eq('type', type)

        // 3. Delete old programme settings for this session/type
        await adminClient
          .from('formation_programme_settings')
          .delete()
          .eq('session_id', sessionId)
          .eq('type', type)

        // 4. Create new programme settings + atelier mappings
        const settingsToInsert: Array<{
          session_id: string
          type: string
          programme: string
          max_succ: number
          max_franchise: number
        }> = []

        const mappingsToInsert: Array<{
          session_id: string
          type: string
          programme: string
          atelier_id: string
        }> = []

        for (const [programme, atelierNames] of Object.entries(programmeAteliers)) {
          // Create programme setting
          settingsToInsert.push({
            session_id: sessionId,
            type,
            programme,
            max_succ: 0,
            max_franchise: 0,
          })

          // Map ateliers — all should exist now (either pre-existing or just created)
          for (const atelierName of atelierNames) {
            const atelierId = atelierMap.get(atelierName.toLowerCase().trim())
            if (atelierId) {
              mappingsToInsert.push({
                session_id: sessionId,
                type,
                programme,
                atelier_id: atelierId,
              })
            }
          }
        }

        // Insert settings
        if (settingsToInsert.length > 0) {
          const { error: settingsErr } = await adminClient
            .from('formation_programme_settings')
            .insert(settingsToInsert)
          if (settingsErr) {
            logger.error('api.formations.programmeFile.insertSettings', settingsErr)
          }
        }

        // Insert mappings
        if (mappingsToInsert.length > 0) {
          const { error: mappingsErr } = await adminClient
            .from('formation_programme_ateliers')
            .insert(mappingsToInsert)
          if (mappingsErr) {
            logger.error('api.formations.programmeFile.insertMappings', mappingsErr)
          }
        }

        importedProgrammes = programmeNames

        if (createdAteliers.length > 0) {
          logger.info('api.formations.programmeFile.createdAteliers',
            `${createdAteliers.length} ateliers crees: ${createdAteliers.join(', ')}`
          )
        }

        return NextResponse.json({
          file_url: fileUrl,
          file_name: file.name,
          imported: {
            programmes: programmeNames,
            mappings: mappingsToInsert.length,
            created: createdAteliers,
          },
        })
      }
    } catch (parseError) {
      logger.error('api.formations.programmeFile.excelParse', parseError, { sessionId, type })
      // Continue — file is uploaded even if parsing fails
    }
  }

  // For non-Excel files (or Excel without valid programme columns):
  // Auto-create default programme setting if none exists
  if (!isExcel || importedProgrammes.length === 0) {
    const { data: existingSettings } = await adminClient
      .from('formation_programme_settings')
      .select('id')
      .eq('session_id', sessionId)
      .eq('type', type)
      .limit(1)

    if (!existingSettings || existingSettings.length === 0) {
      const { error: settingError } = await adminClient
        .from('formation_programme_settings')
        .insert({
          session_id: sessionId,
          type,
          programme: 'P1',
          max_succ: 0,
          max_franchise: 0,
        })
      if (settingError) {
        logger.error('api.formations.programmeFile.autoCreateSetting', settingError, { sessionId, type })
      }
    }
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
