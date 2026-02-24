import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  locationImportRowSchema,
  type LocationImportRow,
  type LocationImportResult,
  type LocationImportResponse,
} from '@/lib/utils-app/location-excel-import'

export async function POST(request: Request) {
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

  const body = await request.json()
  const { rows } = body as { rows: LocationImportRow[] }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à importer' }, { status: 400 })
  }

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
    } catch {
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
