import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { importRowSchema, type ImportRow, type ImportResult, type ImportResponse } from '@/lib/utils-app/excel-import'

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
  const { rows } = body as { rows: ImportRow[] }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Aucune donnée à importer' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch existing locations for name -> id resolution
  const { data: locations } = await adminClient
    .from('locations')
    .select('id, name')
    .eq('is_active', true)

  const locationMap = new Map<string, string>()
  for (const loc of locations ?? []) {
    locationMap.set(loc.name.toLowerCase().trim(), loc.id)
  }

  // Auto-create missing locations from the import file
  const uniqueLocationNames = new Set(
    rows
      .map(r => r.location?.trim())
      .filter((name): name is string => !!name && !locationMap.has(name.toLowerCase().trim()))
  )

  for (const name of uniqueLocationNames) {
    const { data: newLoc } = await adminClient
      .from('locations')
      .insert({ name, is_active: true })
      .select('id, name')
      .single()

    if (newLoc) {
      locationMap.set(newLoc.name.toLowerCase().trim(), newLoc.id)
    }
  }

  // Fetch existing profiles to detect duplicates and resolve managers
  const { data: existingProfiles } = await adminClient
    .from('profiles')
    .select('id, email')

  const existingEmailToId = new Map<string, string>()
  for (const p of existingProfiles ?? []) {
    existingEmailToId.set(p.email.toLowerCase(), p.id)
  }

  const results: ImportResult[] = []
  const newlyCreatedEmailToId = new Map<string, string>()

  // First pass: create all users
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Server-side re-validation
    const validation = importRowSchema.safeParse(row)
    if (!validation.success) {
      results.push({
        rowIndex: i + 1,
        email: row.email || '',
        success: false,
        error: validation.error.issues.map(issue => issue.message).join(', '),
      })
      continue
    }

    const data = validation.data

    // Check duplicate
    if (existingEmailToId.has(data.email.toLowerCase())) {
      results.push({
        rowIndex: i + 1,
        email: data.email,
        success: false,
        error: 'Utilisateur déjà existant',
      })
      continue
    }

    // Check if already created in this batch
    if (newlyCreatedEmailToId.has(data.email.toLowerCase())) {
      results.push({
        rowIndex: i + 1,
        email: data.email,
        success: false,
        error: 'Email en doublon dans le fichier',
      })
      continue
    }

    // Resolve location
    const locationId = data.location
      ? locationMap.get(data.location.toLowerCase().trim()) || null
      : null

    // Generate random password
    const password = crypto.randomBytes(16).toString('base64url')

    try {
      // Create user in Supabase Auth
      const { data: newUser, error } = await adminClient.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: data.first_name,
          last_name: data.last_name,
          role: data.role,
        },
      })

      if (error) {
        results.push({
          rowIndex: i + 1,
          email: data.email,
          success: false,
          error: error.message,
        })
        continue
      }

      if (newUser?.user) {
        // Update profile with location and job_title
        const profileUpdate: Record<string, unknown> = {}
        if (locationId) profileUpdate.location_id = locationId
        if (data.job_title) profileUpdate.job_title = data.job_title

        if (Object.keys(profileUpdate).length > 0) {
          await adminClient
            .from('profiles')
            .update(profileUpdate)
            .eq('id', newUser.user.id)
        }

        newlyCreatedEmailToId.set(data.email.toLowerCase(), newUser.user.id)

        results.push({
          rowIndex: i + 1,
          email: data.email,
          success: true,
        })

        // Send password reset email
        try {
          await adminClient.auth.admin.generateLink({
            type: 'recovery',
            email: data.email,
          })
        } catch {
          // Best-effort, don't fail the import
        }
      }
    } catch (err) {
      results.push({
        rowIndex: i + 1,
        email: data.email,
        success: false,
        error: 'Erreur inattendue lors de la création',
      })
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50))
  }

  // Second pass: resolve manager references
  const allEmailToId = new Map([...existingEmailToId, ...newlyCreatedEmailToId])

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const result = results.find(r => r.rowIndex === i + 1)

    if (!result?.success || !row.manager) continue

    const managerId = allEmailToId.get(row.manager.toLowerCase().trim())
    const userId = allEmailToId.get(row.email.toLowerCase())

    if (managerId && userId) {
      await adminClient
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', userId)
    } else if (row.manager && !managerId) {
      result.warning = (result.warning ? result.warning + '. ' : '') +
        `Manager "${row.manager}" non trouvé`
    }
  }

  const summary = {
    total: rows.length,
    created: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  }

  return NextResponse.json({ results, summary } satisfies ImportResponse)
}
