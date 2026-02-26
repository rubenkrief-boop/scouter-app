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
    .or('status.eq.completed,is_continuous.eq.true')

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

// ============================================
// Progression temporelle (Évolution)
// ============================================

export interface ProgressionPoint {
  date: string       // ISO date string
  dateLabel: string   // Formatted label for display
  avgScore: number    // Average score at this point
}

export interface WorkerProgression {
  userId: string
  name: string
  locationName: string | null
  points: ProgressionPoint[]
}

export interface ProgressionData {
  teamTimeline: ProgressionPoint[]
  workers: WorkerProgression[]
}

/**
 * Get temporal progression data from evaluation snapshots.
 * Each snapshot captures module scores at a point in time.
 */
export async function getProgressionData(): Promise<ProgressionData> {
  const supabase = await createClient()

  // Get all continuous evaluations
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      id,
      audioprothesiste_id,
      job_profile_id,
      audioprothesiste:profiles!audioprothesiste_id(
        id, first_name, last_name,
        location:locations(name)
      )
    `)
    .eq('is_continuous', true)

  if (!evaluations || evaluations.length === 0) {
    return { teamTimeline: [], workers: [] }
  }

  // Get assignments to know which modules belong to which profile
  const workerIds = [...new Set(evaluations.map(e => e.audioprothesiste_id))]
  const { data: assignments } = await supabase
    .from('audioprothesiste_assignments')
    .select('audioprothesiste_id, job_profile_id')
    .in('audioprothesiste_id', workerIds)

  // Get expected modules per job profile
  const profileIds = [...new Set((assignments ?? []).map(a => a.job_profile_id))]
  let profileModuleMap = new Map<string, Set<string>>()
  if (profileIds.length > 0) {
    const { data: jpComps } = await supabase
      .from('job_profile_competencies')
      .select('job_profile_id, module_id')
      .in('job_profile_id', profileIds)
    for (const jpc of (jpComps ?? [])) {
      if (!profileModuleMap.has(jpc.job_profile_id)) {
        profileModuleMap.set(jpc.job_profile_id, new Set())
      }
      profileModuleMap.get(jpc.job_profile_id)!.add(jpc.module_id)
    }
  }

  // Build worker -> set of relevant module IDs
  const workerModuleIds = new Map<string, Set<string>>()
  for (const a of (assignments ?? [])) {
    if (!workerModuleIds.has(a.audioprothesiste_id)) {
      workerModuleIds.set(a.audioprothesiste_id, new Set())
    }
    const profileModules = profileModuleMap.get(a.job_profile_id)
    if (profileModules) {
      for (const mid of profileModules) {
        workerModuleIds.get(a.audioprothesiste_id)!.add(mid)
      }
    }
  }

  // Fetch snapshots for all evaluations in parallel
  const snapshotPromises = evaluations.map(async (evaluation) => {
    const { data, error } = await supabase
      .rpc('get_snapshot_history', { p_evaluation_id: evaluation.id })

    if (error || !data) return null
    return { evaluation, snapshots: data as any[] }
  })

  const results = await Promise.all(snapshotPromises)

  // Build per-worker timelines
  const workerTimelineMap = new Map<string, {
    name: string
    locationName: string | null
    points: Map<string, number[]> // date -> scores
  }>()

  for (const result of results) {
    if (!result) continue
    const { evaluation, snapshots } = result
    const audio = evaluation.audioprothesiste as any
    const uid = evaluation.audioprothesiste_id
    const name = `${audio?.first_name ?? ''} ${audio?.last_name ?? ''}`
    const locationName = audio?.location?.name ?? null
    const relevantModules = workerModuleIds.get(uid)

    if (!workerTimelineMap.has(uid)) {
      workerTimelineMap.set(uid, { name, locationName, points: new Map() })
    }

    for (const snapshot of snapshots) {
      const moduleScores = snapshot.module_scores as any[] | null
      if (!moduleScores || moduleScores.length === 0) continue

      // Filter by relevant modules if available
      const filtered = relevantModules && relevantModules.size > 0
        ? moduleScores.filter((ms: any) => relevantModules.has(ms.module_id))
        : moduleScores

      if (filtered.length === 0) continue

      const avg = filtered.reduce((sum: number, ms: any) =>
        sum + (parseFloat(ms.completion_pct) || 0), 0) / filtered.length

      const dateKey = new Date(snapshot.snapshot_date).toISOString().split('T')[0]
      const worker = workerTimelineMap.get(uid)!

      if (!worker.points.has(dateKey)) {
        worker.points.set(dateKey, [])
      }
      worker.points.get(dateKey)!.push(Math.round(avg * 10) / 10)
    }
  }

  // Convert to sorted arrays
  const workers: WorkerProgression[] = []
  const teamPointsMap = new Map<string, number[]>() // date -> all worker averages

  for (const [userId, data] of workerTimelineMap) {
    const points: ProgressionPoint[] = []
    for (const [date, scores] of data.points) {
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      points.push({
        date,
        dateLabel: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        avgScore: avg,
      })
      // Accumulate for team average
      if (!teamPointsMap.has(date)) {
        teamPointsMap.set(date, [])
      }
      teamPointsMap.get(date)!.push(avg)
    }
    points.sort((a, b) => a.date.localeCompare(b.date))

    if (points.length > 0) {
      workers.push({ userId, name: data.name, locationName: data.locationName, points })
    }
  }

  // Build team timeline
  const teamTimeline: ProgressionPoint[] = Array.from(teamPointsMap.entries())
    .map(([date, scores]) => ({
      date,
      dateLabel: new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Sort workers by name
  workers.sort((a, b) => a.name.localeCompare(b.name))

  return { teamTimeline, workers }
}

// ============================================
// Gap Analysis & Alertes
// ============================================

export interface GapModuleData {
  moduleId: string
  moduleCode: string
  moduleName: string
  avgActual: number
  avgExpected: number
  gap: number             // expected - actual (positive = below expected)
  workersBelow: {
    userId: string
    name: string
    score: number
    expected: number
    gap: number
  }[]
}

export interface AlertData {
  userId: string
  name: string
  locationName: string | null
  moduleCode: string
  moduleName: string
  score: number
  expected: number
  gap: number
}

export interface GapAnalysisResult {
  modules: GapModuleData[]
  alerts: AlertData[]
}

/**
 * Compute gap analysis: actual vs expected scores per module,
 * and generate alerts for workers below threshold.
 */
export async function getGapAnalysis(): Promise<GapAnalysisResult> {
  const supabase = await createClient()

  // 1. Get all continuous evaluations with worker info
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      id,
      audioprothesiste_id,
      job_profile_id,
      audioprothesiste:profiles!audioprothesiste_id(
        id, first_name, last_name,
        location:locations(name)
      )
    `)
    .eq('is_continuous', true)

  if (!evaluations || evaluations.length === 0) {
    return { modules: [], alerts: [] }
  }

  // 2. Get current module scores for all evaluations
  const evalIds = evaluations.map(e => e.id)
  const { data: batchScores } = await supabase
    .rpc('get_batch_module_scores', { p_evaluation_ids: evalIds })

  // 3. Get worker -> job profile assignments
  const workerIds = [...new Set(evaluations.map(e => e.audioprothesiste_id))]
  const { data: assignments } = await supabase
    .from('audioprothesiste_assignments')
    .select('audioprothesiste_id, job_profile_id')
    .in('audioprothesiste_id', workerIds)

  // 4. Get expected scores per job profile per module
  const profileIds = [...new Set((assignments ?? []).map(a => a.job_profile_id))]
  let expectedMap = new Map<string, Map<string, number>>() // profile_id -> module_id -> expected_score

  if (profileIds.length > 0) {
    const { data: jpComps } = await supabase
      .from('job_profile_competencies')
      .select('job_profile_id, module_id, expected_score')
      .in('job_profile_id', profileIds)

    for (const jpc of (jpComps ?? [])) {
      if (!expectedMap.has(jpc.job_profile_id)) {
        expectedMap.set(jpc.job_profile_id, new Map())
      }
      expectedMap.get(jpc.job_profile_id)!.set(jpc.module_id, jpc.expected_score)
    }
  }

  // 5. Build worker -> profile IDs mapping
  const workerProfilesMap = new Map<string, string[]>()
  for (const a of (assignments ?? [])) {
    if (!workerProfilesMap.has(a.audioprothesiste_id)) {
      workerProfilesMap.set(a.audioprothesiste_id, [])
    }
    workerProfilesMap.get(a.audioprothesiste_id)!.push(a.job_profile_id)
  }

  // 6. For each worker, get their expected score per module (best expected if multiple profiles)
  const workerExpectedByModule = new Map<string, Map<string, number>>() // worker_id -> module_id -> expected
  for (const [workerId, profileIdsList] of workerProfilesMap) {
    const moduleExpected = new Map<string, number>()
    for (const pid of profileIdsList) {
      const profileExpected = expectedMap.get(pid)
      if (profileExpected) {
        for (const [moduleId, expected] of profileExpected) {
          // Take the highest expected score if worker has multiple profiles
          const current = moduleExpected.get(moduleId) ?? 0
          if (expected > current) {
            moduleExpected.set(moduleId, expected)
          }
        }
      }
    }
    workerExpectedByModule.set(workerId, moduleExpected)
  }

  // 7. Build worker -> evaluation_id mapping
  const workerEvalMap = new Map<string, string>()
  for (const e of evaluations) {
    workerEvalMap.set(e.audioprothesiste_id, e.id)
  }

  // 8. Build actual scores per worker per module
  const workerActualByModule = new Map<string, Map<string, number>>() // worker_id -> module_id -> score
  const moduleInfo = new Map<string, { code: string; name: string }>()

  for (const ms of (batchScores ?? [])) {
    const evaluation = evaluations.find(e => e.id === ms.evaluation_id)
    if (!evaluation) continue

    const workerId = evaluation.audioprothesiste_id
    if (!workerActualByModule.has(workerId)) {
      workerActualByModule.set(workerId, new Map())
    }
    workerActualByModule.get(workerId)!.set(ms.module_id, parseFloat(ms.completion_pct) || 0)
    moduleInfo.set(ms.module_id, { code: ms.module_code, name: ms.module_name })
  }

  // 9. Aggregate gap analysis per module
  const gapByModule = new Map<string, {
    actualScores: number[]
    expectedScores: number[]
    workersBelow: { userId: string; name: string; score: number; expected: number; gap: number }[]
  }>()

  for (const [workerId, moduleExpected] of workerExpectedByModule) {
    const actualMap = workerActualByModule.get(workerId) ?? new Map()
    const audio = evaluations.find(e => e.audioprothesiste_id === workerId)?.audioprothesiste as any
    const name = `${audio?.first_name ?? ''} ${audio?.last_name ?? ''}`

    for (const [moduleId, expected] of moduleExpected) {
      const actual = actualMap.get(moduleId) ?? 0

      if (!gapByModule.has(moduleId)) {
        gapByModule.set(moduleId, { actualScores: [], expectedScores: [], workersBelow: [] })
      }

      const moduleData = gapByModule.get(moduleId)!
      moduleData.actualScores.push(actual)
      moduleData.expectedScores.push(expected)

      if (actual < expected) {
        moduleData.workersBelow.push({
          userId: workerId,
          name,
          score: Math.round(actual * 10) / 10,
          expected,
          gap: Math.round((expected - actual) * 10) / 10,
        })
      }
    }
  }

  // 10. Build final module gap data
  const modules: GapModuleData[] = []
  for (const [moduleId, data] of gapByModule) {
    const info = moduleInfo.get(moduleId)
    if (!info) continue

    const avgActual = data.actualScores.length > 0
      ? Math.round((data.actualScores.reduce((a, b) => a + b, 0) / data.actualScores.length) * 10) / 10
      : 0
    const avgExpected = data.expectedScores.length > 0
      ? Math.round((data.expectedScores.reduce((a, b) => a + b, 0) / data.expectedScores.length) * 10) / 10
      : 0

    // Sort workers below by gap descending
    data.workersBelow.sort((a, b) => b.gap - a.gap)

    modules.push({
      moduleId,
      moduleCode: info.code,
      moduleName: info.name,
      avgActual,
      avgExpected,
      gap: Math.round((avgExpected - avgActual) * 10) / 10,
      workersBelow: data.workersBelow,
    })
  }

  // Sort modules by gap descending (worst first)
  modules.sort((a, b) => b.gap - a.gap)

  // 11. Build alerts: all workers below threshold, sorted by gap
  const alerts: AlertData[] = []
  for (const mod of modules) {
    for (const worker of mod.workersBelow) {
      const audio = evaluations.find(e => e.audioprothesiste_id === worker.userId)?.audioprothesiste as any
      alerts.push({
        userId: worker.userId,
        name: worker.name,
        locationName: audio?.location?.name ?? null,
        moduleCode: mod.moduleCode,
        moduleName: mod.moduleName,
        score: worker.score,
        expected: worker.expected,
        gap: worker.gap,
      })
    }
  }

  // Sort alerts by gap descending (most urgent first)
  alerts.sort((a, b) => b.gap - a.gap)

  return { modules, alerts }
}
