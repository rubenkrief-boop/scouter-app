'use server'

import { createClient } from '@/lib/supabase/server'

export interface UserModuleScore {
  user_id: string
  first_name: string
  last_name: string
  email: string
  location_name: string | null
  module_id: string
  module_code: string
  module_name: string
  avg_score: number
  eval_count: number
}

export interface ModuleGlobalStat {
  module_id: string
  module_code: string
  module_name: string
  avg_score: number
  min_score: number
  max_score: number
  user_count: number
}

export interface UserSummary {
  user_id: string
  first_name: string
  last_name: string
  email: string
  location_name: string | null
  overall_avg: number
  eval_count: number
  modules: { module_code: string; module_name: string; avg_score: number }[]
}

/**
 * Get all completed evaluations with scores aggregated per user per module
 * Uses batch RPC to avoid N+1 queries
 */
export async function getGlobalStatistics(): Promise<{
  moduleStats: ModuleGlobalStat[]
  userSummaries: UserSummary[]
}> {
  const supabase = await createClient()

  // Get all completed evaluations with their module scores
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      id,
      audioprothesiste_id,
      job_profile_id,
      status,
      audioprothesiste:profiles!audioprothesiste_id(
        id, first_name, last_name, email,
        location:locations(name)
      )
    `)
    .eq('status', 'completed')

  if (!evaluations || evaluations.length === 0) {
    return { moduleStats: [], userSummaries: [] }
  }

  // Get module scores for ALL evaluations in a single batch call
  const evaluationIds = evaluations.map(e => e.id)

  // Try batch function first, fall back to parallel calls if not available
  let allScores: {
    user_id: string
    first_name: string
    last_name: string
    email: string
    location_name: string | null
    module_id: string
    module_code: string
    module_name: string
    score: number
  }[] = []

  const { data: batchScores, error: batchError } = await supabase
    .rpc('get_batch_module_scores', { p_evaluation_ids: evaluationIds })

  if (!batchError && batchScores) {
    // Use batch results
    for (const ms of batchScores) {
      const evaluation = evaluations.find(e => e.id === ms.evaluation_id)
      if (!evaluation) continue
      const audio = evaluation.audioprothesiste as any
      allScores.push({
        user_id: evaluation.audioprothesiste_id,
        first_name: audio?.first_name ?? '',
        last_name: audio?.last_name ?? '',
        email: audio?.email ?? '',
        location_name: audio?.location?.name ?? null,
        module_id: ms.module_id,
        module_code: ms.module_code,
        module_name: ms.module_name,
        score: parseFloat(ms.completion_pct) || 0,
      })
    }
  } else {
    // Fallback: parallel individual calls (if batch function not yet deployed)
    const scorePromises = evaluations.map(async (evaluation) => {
      try {
        const { data: scores, error } = await supabase.rpc('get_module_scores', { p_evaluation_id: evaluation.id })
        if (error || !scores) {
          console.warn(`Score fetch failed for evaluation ${evaluation.id}:`, error?.message)
          return
        }
        const audio = evaluation.audioprothesiste as any
        for (const ms of scores) {
          allScores.push({
            user_id: evaluation.audioprothesiste_id,
            first_name: audio?.first_name ?? '',
            last_name: audio?.last_name ?? '',
            email: audio?.email ?? '',
            location_name: audio?.location?.name ?? null,
            module_id: ms.module_id,
            module_code: ms.module_code,
            module_name: ms.module_name,
            score: parseFloat(ms.completion_pct) || 0,
          })
        }
      } catch (err) {
        console.warn(`Score fetch error for evaluation ${evaluation.id}:`, err)
      }
    })
    await Promise.all(scorePromises)
  }

  // Aggregate: global per module
  const moduleMap = new Map<string, { scores: number[]; code: string; name: string }>()
  for (const s of allScores) {
    if (!moduleMap.has(s.module_id)) {
      moduleMap.set(s.module_id, { scores: [], code: s.module_code, name: s.module_name })
    }
    moduleMap.get(s.module_id)!.scores.push(s.score)
  }

  const moduleStats: ModuleGlobalStat[] = Array.from(moduleMap.entries()).map(([id, data]) => ({
    module_id: id,
    module_code: data.code,
    module_name: data.name,
    avg_score: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
    min_score: Math.round(Math.min(...data.scores) * 10) / 10,
    max_score: Math.round(Math.max(...data.scores) * 10) / 10,
    user_count: new Set(allScores.filter(s => s.module_id === id).map(s => s.user_id)).size,
  }))

  // Aggregate: per user summary
  const userMap = new Map<string, {
    first_name: string
    last_name: string
    email: string
    location_name: string | null
    modules: Map<string, { code: string; name: string; scores: number[] }>
    eval_ids: Set<string>
  }>()

  for (const evaluation of evaluations) {
    const audio = evaluation.audioprothesiste as any
    const uid = evaluation.audioprothesiste_id
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        first_name: audio?.first_name ?? '',
        last_name: audio?.last_name ?? '',
        email: audio?.email ?? '',
        location_name: audio?.location?.name ?? null,
        modules: new Map(),
        eval_ids: new Set(),
      })
    }
    userMap.get(uid)!.eval_ids.add(evaluation.id)
  }

  for (const s of allScores) {
    const user = userMap.get(s.user_id)
    if (user) {
      if (!user.modules.has(s.module_id)) {
        user.modules.set(s.module_id, { code: s.module_code, name: s.module_name, scores: [] })
      }
      user.modules.get(s.module_id)!.scores.push(s.score)
    }
  }

  const userSummaries: UserSummary[] = Array.from(userMap.entries()).map(([uid, data]) => {
    const modules = Array.from(data.modules.values()).map(m => ({
      module_code: m.code,
      module_name: m.name,
      avg_score: Math.round((m.scores.reduce((a, b) => a + b, 0) / m.scores.length) * 10) / 10,
    }))

    const allModuleAvgs = modules.map(m => m.avg_score)
    const overall_avg = allModuleAvgs.length > 0
      ? Math.round((allModuleAvgs.reduce((a, b) => a + b, 0) / allModuleAvgs.length) * 10) / 10
      : 0

    return {
      user_id: uid,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      location_name: data.location_name,
      overall_avg,
      eval_count: data.eval_ids.size,
      modules,
    }
  })

  // Sort by overall avg descending
  userSummaries.sort((a, b) => b.overall_avg - a.overall_avg)

  return { moduleStats, userSummaries }
}
