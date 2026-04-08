import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  locationImportRowSchema,
  type LocationImportRow,
  type LocationImportResult,
  type LocationImportResponse,
} from '@/lib/utils-app/location-excel-import'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'
import { LocationsImportBodySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  // Rate limit: 5 imports par minute par IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`locations-import:${ip}`, { maxRequests: 5, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  // Auth check - super_admin only
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

  const parsedBody = LocationsImportBodySchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsedBody.error.flatten() },
      { status: 400 }
    )
  }
  const rows = parsedBody.data.rows as unknown as LocationImportRow[]

  const adminClient = createAdminClient()

  // Fetch existing locations for duplicate detection
  const { data: existingLocations } = await adminClient
    .from('locations')
    .select('id, name')

  const existingNameSet = new Set<string>()
  for (const loc of existingLocations ?? []) {
    existingNameSet.add(loc.name.toLowerCase().trim())
  }

  // Process rows
  const results: LocationImportResult[] = []
  const createdNamesInBatch = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Server-side re-validation
    const validation = locationImportRowSchema.safeParse(row)
    if (!validation.success) {
      results.push({
        rowIndex: i + 1,
        name: row.name || '',
        success: false,
        error: validation.error.issues.map(iss => iss.message).join(', '),
      })
      continue
    }

    const data = validation.data
    const normalizedName = data.name.toLowerCase().trim()

    // Check duplicate against existing DB locations
    if (existingNameSet.has(normalizedName)) {
      results.push({
        rowIndex: i + 1,
        name: data.name,
        success: false,
        error: 'Lieu déjà existant',
      })
      continue
    }

    // Check duplicate within this import batch
    if (createdNamesInBatch.has(normalizedName)) {
      results.push({
        rowIndex: i + 1,
        name: data.name,
        success: false,
        error: 'Nom en doublon dans le fichier',
      })
      continue
    }

    // Insert location
    try {
      const { error } = await adminClient
        .from('locations')
        .insert({
          name: data.name,
          address: data.address || null,
          city: data.city || null,
          postal_code: data.postal_code || null,
          is_active: true,
        })

      if (error) {
        results.push({
          rowIndex: i + 1,
          name: data.name,
          success: false,
          error: error.message,
        })
        continue
      }

      createdNamesInBatch.add(normalizedName)
      results.push({
        rowIndex: i + 1,
        name: data.name,
        success: true,
      })
    } catch (err) {
      logger.error('api.locations.import', err, { rowIndex: i + 1, name: data.name })
      results.push({
        rowIndex: i + 1,
        name: data.name,
        success: false,
        error: 'Erreur inattendue lors de la création',
      })
    }
  }

  const summary = {
    total: rows.length,
    created: results.filter(r => r.success).length,
    skipped: results.filter(r => !r.success && r.error?.includes('existant')).length,
    failed: results.filter(r => !r.success && !r.error?.includes('existant')).length,
  }

  return NextResponse.json({ results, summary } satisfies LocationImportResponse)
}
