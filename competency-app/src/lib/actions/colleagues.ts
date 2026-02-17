'use server'

import { createClient } from '@/lib/supabase/server'
import type { RadarDataPoint } from '@/lib/types'

export interface ColleagueSummary {
  id: string
  first_name: string
  last_name: string
  email: string
  location_name: string | null
  avg_score: number | null
  eval_count: number
}

export async function getColleagues(): Promise<ColleagueSummary[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get all active audioprothesistes (excluding self)
  const { data: profiles } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email,
      location:locations(name)
    `)
    .eq('role', 'worker')
    .eq('is_active', true)
    .neq('id', user.id)
    .order('last_name', { ascending: true })

  if (!profiles) return []

  // For each colleague, get their latest completed evaluation score
  const colleagues: ColleagueSummary[] = []

  for (const p of profiles) {
    const loc = p.location as any
    const { count } = await supabase
      .from('evaluations')
      .select('*', { count: 'exact', head: true })
      .eq('audioprothesiste_id', p.id)
      .eq('status', 'completed')

    // Get latest completed evaluation for avg score
    let avg_score: number | null = null
    const { data: latestEval } = await supabase
      .from('evaluations')
      .select('id')
      .eq('audioprothesiste_id', p.id)
      .eq('status', 'completed')
      .order('evaluated_at', { ascending: false })
      .limit(1)
      .single()

    if (latestEval) {
      const { data: scores } = await supabase
        .rpc('get_module_scores', { p_evaluation_id: latestEval.id })

      if (scores && scores.length > 0) {
        const total = scores.reduce((sum: number, s: any) => sum + (parseFloat(s.completion_pct) || 0), 0)
        avg_score = Math.round((total / scores.length) * 10) / 10
      }
    }

    colleagues.push({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      location_name: loc?.name ?? null,
      avg_score,
      eval_count: count ?? 0,
    })
  }

  return colleagues
}

export async function getColleagueProfile(colleagueId: string): Promise<{
  profile: { first_name: string; last_name: string; email: string; location_name: string | null }
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
      id, first_name, last_name, email,
      location:locations(name)
    `)
    .eq('id', colleagueId)
    .eq('role', 'worker')
    .eq('is_active', true)
    .single()

  if (!profile) return null

  const loc = profile.location as any

  // Get latest completed evaluation
  const { data: latestEval } = await supabase
    .from('evaluations')
    .select(`*, job_profile:job_profiles(name)`)
    .eq('audioprothesiste_id', colleagueId)
    .eq('status', 'completed')
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .single()

  let radarData: RadarDataPoint[] = []
  let jobProfileName: string | null = null

  if (latestEval) {
    jobProfileName = (latestEval.job_profile as any)?.name ?? null

    const { data: moduleScores } = await supabase
      .rpc('get_module_scores', { p_evaluation_id: latestEval.id })

    let expectedScores: Record<string, number> = {}
    if (latestEval.job_profile_id) {
      const { data: jpComps } = await supabase
        .from('job_profile_competencies')
        .select('*')
        .eq('job_profile_id', latestEval.job_profile_id)

      jpComps?.forEach((jpc) => {
        expectedScores[jpc.module_id] = jpc.expected_score
      })
    }

    radarData = (moduleScores ?? []).map((ms: any) => ({
      module: `${ms.module_code} - ${ms.module_name}`,
      actual: parseFloat(ms.completion_pct) || 0,
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
      location_name: loc?.name ?? null,
    },
    radarData,
    evalCount: count ?? 0,
    jobProfileName,
  }
}
