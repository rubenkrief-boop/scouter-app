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

  // Migration 00013: Continuous evaluation — create snapshots + mark latest as continuous
  try {
    // Step 1: Get all completed evaluations
    const { data: completedEvals, error: evalErr } = await supabase
      .from('evaluations')
      .select('id, audioprothesiste_id, evaluator_id, evaluated_at, job_profile_id')
      .eq('status', 'completed')
      .order('evaluated_at', { ascending: false })

    if (evalErr) {
      results.push(`Migration 00013: Error fetching evaluations: ${evalErr.message}`)
    } else if (!completedEvals || completedEvals.length === 0) {
      results.push('Migration 00013: No completed evaluations found')
    } else {
      // Step 2: Check if snapshots already exist (idempotent)
      const { count: existingSnapshots } = await supabase
        .from('evaluation_snapshots')
        .select('*', { count: 'exact', head: true })

      if ((existingSnapshots ?? 0) > 0) {
        results.push(`Migration 00013: ${existingSnapshots} snapshots already exist — skipping snapshot creation`)
      } else {
        // Create a snapshot for each completed evaluation
        let snapshotCount = 0

        for (const evaluation of completedEvals) {
          try {
            // Get the evaluation results and qualifier answers
            const { data: evalResults } = await supabase
              .from('evaluation_results')
              .select('id, competency_id')
              .eq('evaluation_id', evaluation.id)

            if (!evalResults || evalResults.length === 0) continue

            const resultIds = evalResults.map(r => r.id)
            const { data: qualifierAnswers } = await supabase
              .from('evaluation_result_qualifiers')
              .select('evaluation_result_id, qualifier_id, qualifier_option_id')
              .in('evaluation_result_id', resultIds)

            // Build scores JSON: { competency_id: { qualifier_id: option_id } }
            const scores: Record<string, Record<string, string>> = {}
            const resultToCompetency = new Map(evalResults.map(r => [r.id, r.competency_id]))

            for (const qa of (qualifierAnswers ?? [])) {
              const compId = resultToCompetency.get(qa.evaluation_result_id)
              if (!compId) continue
              if (!scores[compId]) scores[compId] = {}
              scores[compId][qa.qualifier_id] = qa.qualifier_option_id
            }

            // Get module scores via RPC
            const { data: moduleScores } = await supabase
              .rpc('get_module_scores', { p_evaluation_id: evaluation.id })

            // Insert snapshot
            const { error: snapErr } = await supabase
              .from('evaluation_snapshots')
              .insert({
                evaluation_id: evaluation.id,
                snapshot_by: evaluation.evaluator_id,
                scores,
                module_scores: moduleScores ? JSON.parse(JSON.stringify(moduleScores)) : null,
                created_at: evaluation.evaluated_at || new Date().toISOString(),
              })

            if (!snapErr) snapshotCount++
          } catch (err: any) {
            results.push(`Migration 00013: Snapshot error for eval ${evaluation.id}: ${err.message}`)
          }
        }

        results.push(`Migration 00013: Created ${snapshotCount} snapshots from ${completedEvals.length} completed evaluations`)
      }

      // Step 3: Mark the most recent evaluation per worker as is_continuous
      const workerLatest = new Map<string, { id: string; evaluated_at: string | null }>()

      for (const evaluation of completedEvals) {
        const key = `${evaluation.audioprothesiste_id}|${evaluation.job_profile_id ?? 'null'}`
        if (!workerLatest.has(key)) {
          workerLatest.set(key, { id: evaluation.id, evaluated_at: evaluation.evaluated_at })
        }
      }

      // Check if any continuous evaluations already exist
      const { count: continuousCount } = await supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true })
        .eq('is_continuous', true)

      if ((continuousCount ?? 0) > 0) {
        results.push(`Migration 00013: ${continuousCount} continuous evaluations already exist — skipping conversion`)
      } else {
        let convertedCount = 0
        for (const [, latest] of workerLatest) {
          const { error: updateErr } = await supabase
            .from('evaluations')
            .update({ is_continuous: true, status: 'in_progress' })
            .eq('id', latest.id)

          if (!updateErr) convertedCount++
        }
        results.push(`Migration 00013: Converted ${convertedCount} evaluations to continuous`)
      }
    }
  } catch (e: any) {
    results.push(`Migration 00013 error: ${e.message}`)
  }

  // Migration 00014: Backfill job_profile_id on profiles from job_title text
  try {
    const { data: jobProfilesList } = await supabase
      .from('job_profiles')
      .select('id, name')
      .eq('is_active', true)

    const { data: profilesWithJobTitle } = await supabase
      .from('profiles')
      .select('id, job_title, job_profile_id')
      .not('job_title', 'is', null)
      .is('job_profile_id', null)

    let backfilledCount = 0
    if (jobProfilesList && profilesWithJobTitle) {
      const jpMap = new Map<string, string>()
      for (const jp of jobProfilesList) {
        jpMap.set(jp.name.toLowerCase().trim(), jp.id)
      }

      for (const p of profilesWithJobTitle) {
        const jpId = jpMap.get((p.job_title ?? '').toLowerCase().trim())
        if (jpId) {
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ job_profile_id: jpId })
            .eq('id', p.id)

          if (!updateErr) backfilledCount++
        }
      }
    }

    results.push(`Migration 00014: Backfilled ${backfilledCount} profiles with job_profile_id`)
  } catch (e: any) {
    results.push(`Migration 00014 error: ${e.message}`)
  }

  return NextResponse.json({ results })
}
