import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/utils-app/rate-limit'

// Temporary migration endpoint — DELETE after use
export async function POST(request: Request) {
  // Rate limit: 3 appels par minute par IP (route très sensible)
  const ip = getClientIp(request)
  const rl = checkRateLimit(`migrate:${ip}`, { maxRequests: 3, windowSeconds: 60 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  const { secret } = await request.json()

  // Simple secret to prevent accidental calls
  if (secret !== 'run-migrations-2024') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const results: string[] = []

  // Migration 00010: Add job_title to profiles
  try {
    // Check if column already exists
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('job_title')
      .limit(1)

    if (testError && testError.code === '42703') {
      // Column doesn't exist — we can't run ALTER TABLE via REST API
      // But we CAN use the Supabase SQL function workaround:
      // Create column by inserting via admin and using raw SQL through a function
      results.push('job_title column does not exist — need SQL editor for ALTER TABLE')
    } else {
      results.push('job_title column already exists')
    }
  } catch (e: any) {
    results.push('job_title check error: ' + e.message)
  }

  // Migration 00009: Deduplicate competencies
  try {
    // Find duplicates
    const { data: allComps } = await supabase
      .from('competencies')
      .select('id, module_id, name, created_at')
      .order('created_at', { ascending: true })

    if (allComps) {
      const seen = new Map<string, string>() // "module_id|name" -> first id
      const toDelete: string[] = []

      for (const comp of allComps) {
        const key = `${comp.module_id}|${comp.name}`
        if (seen.has(key)) {
          toDelete.push(comp.id)
        } else {
          seen.set(key, comp.id)
        }
      }

      if (toDelete.length > 0) {
        // Delete in batches of 50
        for (let i = 0; i < toDelete.length; i += 50) {
          const batch = toDelete.slice(i, i + 50)
          const { error } = await supabase
            .from('competencies')
            .delete()
            .in('id', batch)
          if (error) {
            results.push(`Delete batch error: ${error.message}`)
          }
        }
        results.push(`Deleted ${toDelete.length} duplicate competencies`)
      } else {
        results.push('No duplicate competencies found')
      }
    }
  } catch (e: any) {
    results.push('Deduplicate error: ' + e.message)
  }

  return NextResponse.json({ results })
}
