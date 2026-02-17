'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  EvaluationWithRelations,
  EvaluationResult,
  EvaluationResultQualifier,
} from '@/lib/types'

export async function getEvaluations(): Promise<EvaluationWithRelations[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return []

  let query = supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluations_evaluator_id_fkey(*),
      audioprothesiste:profiles!evaluations_audioprothesiste_id_fkey(*),
      job_profile:job_profiles(*)
    `)
    .order('created_at', { ascending: false })

  // Filter based on role
  if (profile.role === 'worker') {
    query = query.eq('audioprothesiste_id', user.id)
  }
  // manager, super_admin and skill_master see all evaluations

  const { data, error } = await query

  if (error) {
    console.error('Error fetching evaluations:', error)
    return []
  }

  const evaluations = (data ?? []) as EvaluationWithRelations[]

  // For managers, get team member IDs and sort team first
  if (profile.role === 'manager') {
    const { data: teamMembers } = await supabase
      .from('profiles')
      .select('id')
      .eq('manager_id', user.id)

    const teamIds = new Set((teamMembers ?? []).map(m => m.id))

    // Tag each evaluation with isMyTeam flag
    const tagged = evaluations.map(e => ({
      ...e,
      _isMyTeam: teamIds.has(e.audioprothesiste_id),
    }))

    // Sort: team first, then others
    tagged.sort((a, b) => {
      if (a._isMyTeam && !b._isMyTeam) return -1
      if (!a._isMyTeam && b._isMyTeam) return 1
      return 0
    })

    return tagged as EvaluationWithRelations[]
  }

  return evaluations
}

export async function getEvaluation(id: string): Promise<{
  evaluation: EvaluationWithRelations
  results: EvaluationResult[]
  qualifierAnswers: EvaluationResultQualifier[]
} | null> {
  const supabase = await createClient()

  // Fetch evaluation with relations
  const { data: evaluation, error: evalError } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:profiles!evaluations_evaluator_id_fkey(*),
      audioprothesiste:profiles!evaluations_audioprothesiste_id_fkey(*),
      job_profile:job_profiles(*)
    `)
    .eq('id', id)
    .single()

  if (evalError) {
    console.error('Error fetching evaluation:', evalError)
    return null
  }

  // Fetch all evaluation results
  const { data: results, error: resultsError } = await supabase
    .from('evaluation_results')
    .select('*')
    .eq('evaluation_id', id)

  if (resultsError) {
    console.error('Error fetching evaluation results:', resultsError)
    return null
  }

  // Fetch all qualifier answers for these results
  const resultIds = (results ?? []).map((r) => r.id)
  let qualifierAnswers: EvaluationResultQualifier[] = []

  if (resultIds.length > 0) {
    const { data: answers, error: answersError } = await supabase
      .from('evaluation_result_qualifiers')
      .select('*')
      .in('evaluation_result_id', resultIds)

    if (answersError) {
      console.error('Error fetching qualifier answers:', answersError)
      return null
    }

    qualifierAnswers = (answers ?? []) as EvaluationResultQualifier[]
  }

  return {
    evaluation: evaluation as EvaluationWithRelations,
    results: (results ?? []) as EvaluationResult[],
    qualifierAnswers,
  }
}

export async function createEvaluation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (!['skill_master', 'manager', 'super_admin'].includes(profile.role))) {
    return { error: 'Acces refuse. Role requis pour evaluer.' }
  }

  const audioprothesiste_id = formData.get('audioprothesiste_id') as string
  const job_profile_id = formData.get('job_profile_id') as string | null
  const title = formData.get('title') as string | null

  if (!audioprothesiste_id) {
    return { error: 'audioprothesiste_id est requis.' }
  }

  // Manager can only create evaluations for their team members
  if (profile.role === 'manager') {
    const { data: teamMember } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', audioprothesiste_id)
      .eq('manager_id', user.id)
      .single()

    if (!teamMember) {
      return { error: 'Acces refuse. Vous ne pouvez evaluer que les membres de votre equipe.' }
    }
  }

  const { data, error } = await supabase
    .from('evaluations')
    .insert({
      evaluator_id: user.id,
      audioprothesiste_id,
      job_profile_id: job_profile_id || null,
      title: title || null,
      notes: null,
      status: 'draft' as const,
      evaluated_at: null,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/evaluator/evaluations')
  return { id: data.id }
}

export async function updateEvaluationResults(
  evaluationId: string,
  results: Record<string, Record<string, string>>
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (!['skill_master', 'manager', 'super_admin'].includes(profile.role))) {
    return { error: 'Acces refuse. Role requis pour evaluer.' }
  }

  // Verify the evaluation exists and belongs to this evaluator (or user is super_admin)
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('evaluator_id, status')
    .eq('id', evaluationId)
    .single()

  if (!evaluation) {
    return { error: 'Evaluation introuvable.' }
  }

  if (evaluation.status === 'completed') {
    return { error: 'Cette evaluation est deja terminee.' }
  }

  if (profile.role !== 'super_admin' && evaluation.evaluator_id !== user.id) {
    return { error: 'Acces refuse. Vous ne pouvez modifier que vos propres evaluations.' }
  }

  // Update status to in_progress if still draft
  if (evaluation.status === 'draft') {
    await supabase
      .from('evaluations')
      .update({ status: 'in_progress' })
      .eq('id', evaluationId)
  }

  // Process each competency's qualifier answers
  // results format: { competencyId: { qualifierId: optionId } }
  for (const [competencyId, qualifierMap] of Object.entries(results)) {
    // Upsert evaluation_result for this competency
    const { data: existingResult } = await supabase
      .from('evaluation_results')
      .select('id')
      .eq('evaluation_id', evaluationId)
      .eq('competency_id', competencyId)
      .single()

    let resultId: string

    if (existingResult) {
      resultId = existingResult.id
    } else {
      const { data: newResult, error: insertError } = await supabase
        .from('evaluation_results')
        .insert({
          evaluation_id: evaluationId,
          competency_id: competencyId,
        })
        .select('id')
        .single()

      if (insertError || !newResult) {
        return { error: `Erreur lors de la creation du resultat: ${insertError?.message}` }
      }

      resultId = newResult.id
    }

    // Delete existing qualifier answers for this result
    await supabase
      .from('evaluation_result_qualifiers')
      .delete()
      .eq('evaluation_result_id', resultId)

    // Insert new qualifier answers
    const qualifierInserts = Object.entries(qualifierMap).map(
      ([qualifierId, optionId]) => ({
        evaluation_result_id: resultId,
        qualifier_id: qualifierId,
        qualifier_option_id: optionId,
      })
    )

    if (qualifierInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('evaluation_result_qualifiers')
        .insert(qualifierInserts)

      if (insertError) {
        return { error: `Erreur lors de l'enregistrement des reponses: ${insertError.message}` }
      }
    }
  }

  revalidatePath(`/evaluator/evaluations/${evaluationId}`)
}

export async function completeEvaluation(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (!['skill_master', 'manager', 'super_admin'].includes(profile.role))) {
    return { error: 'Acces refuse. Role requis pour evaluer.' }
  }

  // Verify ownership
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('evaluator_id')
    .eq('id', id)
    .single()

  if (!evaluation) {
    return { error: 'Evaluation introuvable.' }
  }

  if (profile.role !== 'super_admin' && evaluation.evaluator_id !== user.id) {
    return { error: 'Acces refuse. Vous ne pouvez completer que vos propres evaluations.' }
  }

  const { error } = await supabase
    .from('evaluations')
    .update({
      status: 'completed' as const,
      evaluated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/evaluator/evaluations')
  revalidatePath(`/evaluator/evaluations/${id}`)
}
