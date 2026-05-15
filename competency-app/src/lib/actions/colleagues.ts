'use server'

import { createClient } from '@/lib/supabase/server'
import type { RadarDataPoint } from '@/lib/types'
import { relLocationName, relJobProfile, readAvatarUrl } from '@/lib/types/relations'

export interface ColleagueSummary {
  id: string
  first_name: string
  last_name: string
  email: string
  avatar_url: string | null
  location_name: string | null
  avg_score: number | null
  eval_count: number
}

export async function getColleagues(): Promise<ColleagueSummary[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get all active workers (excluding self)
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, avatar_url,
      location:locations!location_id(name)
    `)
    .eq('role', 'worker')
    .eq('is_active', true)
    .neq('id', user.id)
    .order('last_name', { ascending: true })

  if (!profiles || profiles.length === 0) return []

  const profileIds = profiles.map(p => p.id)

  // Batch: fetch all completed/continuous evaluations for all colleagues in ONE query
  const { data: allEvals } = await supabase
    .from('evaluations')
    .select('id, audioprothesiste_id, evaluated_at, status, is_continuous')
    .in('audioprothesiste_id', profileIds)
    .or('status.eq.completed,is_continuous.eq.true')
    .order('evaluated_at', { ascending: false })

  // Group evaluations by worker
  const evalsByWorker = new Map<string, { id: string; evaluated_at: string | null }[]>()
  const evalCountByWorker = new Map<string, number>()

  for (const ev of (allEvals ?? [])) {
    const list = evalsByWorker.get(ev.audioprothesiste_id) ?? []
    list.push({ id: ev.id, evaluated_at: ev.evaluated_at })
    evalsByWorker.set(ev.audioprothesiste_id, list)
    evalCountByWorker.set(ev.audioprothesiste_id, (evalCountByWorker.get(ev.audioprothesiste_id) ?? 0) + 1)
  }

  // Batch: get module scores for the latest evaluation of each worker
  const latestEvalIds: string[] = []
  const latestEvalMap = new Map<string, string>() // worker_id -> eval_id
  for (const [workerId, evals] of evalsByWorker) {
    if (evals.length > 0) {
      latestEvalIds.push(evals[0].id)
      latestEvalMap.set(workerId, evals[0].id)
    }
  }

  // Fetch module scores in parallel for all latest evaluations
  const scoresByEvalId = new Map<string, number>()
  if (latestEvalIds.length > 0) {
    const scorePromises = latestEvalIds.map(async (evalId) => {
      const { data: scores } = await supabase
        .rpc('get_module_scores', { p_evaluation_id: evalId })
      if (scores && scores.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const total = scores.reduce((sum: number, s: any) => sum + (parseFloat(s.completion_pct) || 0), 0)
        scoresByEvalId.set(evalId, Math.round((total / scores.length) * 10) / 10)
      }
    })
    await Promise.all(scorePromises)
  }

  // Build result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return profiles.map((p: any) => {
    const loc = p.location as { name: string } | null
    const latestEvalId = latestEvalMap.get(p.id)

    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      avatar_url: p.avatar_url ?? null,
      location_name: loc?.name ?? null,
      avg_score: latestEvalId ? (scoresByEvalId.get(latestEvalId) ?? null) : null,
      eval_count: evalCountByWorker.get(p.id) ?? 0,
    }
  })
}

export async function getColleagueProfile(colleagueId: string): Promise<{
  profile: { first_name: string; last_name: string; email: string; avatar_url: string | null; location_name: string | null }
  radarData: RadarDataPoint[]
  evalCount: number
  jobProfileName: string | null
} | null> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify colleague is an active audioprothesiste
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, avatar_url,
      location:locations!location_id(name)
    `)
    .eq('id', colleagueId)
    .eq('role', 'worker')
    .eq('is_active', true)
    .single()

  if (!profile) return null

  const loc = relLocationName(profile.location)

  // Get latest completed evaluation
  const { data: latestEval } = await supabase
    .from('evaluations')
    .select(`*, job_profile:job_profiles(name)`)
    .eq('audioprothesiste_id', colleagueId)
    .or('status.eq.completed,is_continuous.eq.true')
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .single()

  let radarData: RadarDataPoint[] = []
  let jobProfileName: string | null = null

  if (latestEval) {
    jobProfileName = relJobProfile(latestEval.job_profile)?.name ?? null

    const { data: moduleScores } = await supabase
      .rpc('get_module_scores', { p_evaluation_id: latestEval.id })

    const expectedScores: Record<string, number> = {}
    if (latestEval.job_profile_id) {
      const { data: jpComps } = await supabase
        .from('job_profile_competencies')
        .select('*')
        .eq('job_profile_id', latestEval.job_profile_id)

      jpComps?.forEach((jpc) => {
        expectedScores[jpc.module_id] = jpc.expected_score
      })
    }

    // Ne montrer que les modules rattachés au profil métier (si défini)
    const profileModuleIds = Object.keys(expectedScores)
    radarData = (moduleScores ?? [])
      .filter((ms: { module_id: string }) => profileModuleIds.length === 0 || profileModuleIds.includes(ms.module_id))
      .map((ms: { module_id: string; module_code: string; module_name: string; completion_pct: string | number }) => ({
        module: `${ms.module_code} - ${ms.module_name}`,
        actual: parseFloat(String(ms.completion_pct)) || 0,
        expected: expectedScores[ms.module_id] ?? 0,
        fullMark: 100,
      }))
  }

  const { count } = await supabase
    .from('evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('audioprothesiste_id', colleagueId)

  return {
    profile: {
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      avatar_url: readAvatarUrl(profile),
      location_name: loc?.name ?? null,
    },
    radarData,
    evalCount: count ?? 0,
    jobProfileName,
  }
}
