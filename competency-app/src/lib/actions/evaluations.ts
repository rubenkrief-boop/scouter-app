'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  EvaluationWithRelations,
  EvaluationResult,
  EvaluationResultQualifier,
  SnapshotHistoryEntry,
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

// ============================================================
// Evaluation continue
// ============================================================

/**
 * Trouve ou crée l'évaluation continue d'un collaborateur.
 * S'il n'en existe pas, en crée une et pré-remplit depuis la dernière évaluation.
 */
export async function getOrCreateContinuousEvaluation(
  workerId: string,
  jobProfileId?: string | null
): Promise<{ evaluationId: string } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['skill_master', 'manager', 'super_admin'].includes(profile.role)) {
    return { error: 'Acces refuse.' }
  }

  // Manager : vérifier que le collaborateur fait partie de son équipe
  if (profile.role === 'manager') {
    const { data: teamMember } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', workerId)
      .eq('manager_id', user.id)
      .single()

    if (!teamMember) {
      return { error: 'Acces refuse. Ce collaborateur ne fait pas partie de votre equipe.' }
    }
  }

  // 1. Chercher une évaluation continue existante
  let query = supabase
    .from('evaluations')
    .select('id')
    .eq('audioprothesiste_id', workerId)
    .eq('is_continuous', true)

  if (jobProfileId) {
    query = query.eq('job_profile_id', jobProfileId)
  } else {
    query = query.is('job_profile_id', null)
  }

  const { data: existing } = await query.limit(1).single()

  if (existing) {
    return { evaluationId: existing.id }
  }

  // 2. Créer une nouvelle évaluation continue
  const { data: newEval, error: createError } = await supabase
    .from('evaluations')
    .insert({
      evaluator_id: user.id,
      audioprothesiste_id: workerId,
      job_profile_id: jobProfileId || null,
      title: null,
      notes: null,
      status: 'in_progress' as const,
      is_continuous: true,
      evaluated_at: null,
    })
    .select('id')
    .single()

  if (createError || !newEval) {
    return { error: createError?.message || 'Erreur lors de la creation' }
  }

  // 3. Pré-remplir depuis la dernière évaluation (complétée ou non)
  try {
    let prevQuery = supabase
      .from('evaluations')
      .select('id')
      .eq('audioprothesiste_id', workerId)
      .neq('id', newEval.id)
      .order('evaluated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (jobProfileId) {
      prevQuery = prevQuery.eq('job_profile_id', jobProfileId)
    }

    const { data: prevEvals } = await prevQuery

    if (prevEvals && prevEvals.length > 0) {
      const prevEvalId = prevEvals[0].id

      const { data: prevResults } = await supabase
        .from('evaluation_results')
        .select('*, evaluation_result_qualifiers(*)')
        .eq('evaluation_id', prevEvalId)

      if (prevResults && prevResults.length > 0) {
        const resultRows = prevResults.map(pr => ({
          evaluation_id: newEval.id,
          competency_id: pr.competency_id,
        }))

        const { data: newResults } = await supabase
          .from('evaluation_results')
          .insert(resultRows)
          .select('id, competency_id')

        if (newResults && newResults.length > 0) {
          const resultMap = new Map(newResults.map(r => [r.competency_id, r.id]))

          const allQualifierRows: {
            evaluation_result_id: string
            qualifier_id: string
            qualifier_option_id: string
          }[] = []

          for (const prevResult of prevResults) {
            const newResultId = resultMap.get(prevResult.competency_id)
            if (!newResultId) continue
            const qualifiers = prevResult.evaluation_result_qualifiers as any[]
            if (qualifiers && qualifiers.length > 0) {
              for (const erq of qualifiers) {
                allQualifierRows.push({
                  evaluation_result_id: newResultId,
                  qualifier_id: erq.qualifier_id,
                  qualifier_option_id: erq.qualifier_option_id,
                })
              }
            }
          }

          if (allQualifierRows.length > 0) {
            await supabase
              .from('evaluation_result_qualifiers')
              .insert(allQualifierRows)
          }
        }
      }
    }
  } catch {
    // Pas grave si le pré-remplissage échoue
    console.warn('Pre-fill from previous evaluation failed')
  }

  return { evaluationId: newEval.id }
}

/**
 * Sauvegarde les scores ET crée un snapshot automatiquement.
 */
export async function saveEvaluationWithSnapshot(
  evaluationId: string,
  scores: Record<string, Record<string, string>>
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifie' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['skill_master', 'manager', 'super_admin'].includes(profile.role)) {
    return { error: 'Acces refuse.' }
  }

  // Vérifier que l'évaluation existe
  const { data: evaluation } = await supabase
    .from('evaluations')
    .select('evaluator_id, is_continuous')
    .eq('id', evaluationId)
    .single()

  if (!evaluation) {
    return { error: 'Evaluation introuvable.' }
  }

  // 1. Upsert les scores (même logique que updateEvaluationResults)
  for (const [competencyId, qualifierMap] of Object.entries(scores)) {
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
        .insert({ evaluation_id: evaluationId, competency_id: competencyId })
        .select('id')
        .single()

      if (insertError || !newResult) {
        return { error: `Erreur: ${insertError?.message}` }
      }
      resultId = newResult.id
    }

    await supabase
      .from('evaluation_result_qualifiers')
      .delete()
      .eq('evaluation_result_id', resultId)

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
        return { error: `Erreur: ${insertError.message}` }
      }
    }
  }

  // 2. Mettre à jour evaluated_at
  await supabase
    .from('evaluations')
    .update({ evaluated_at: new Date().toISOString(), status: 'in_progress' as const })
    .eq('id', evaluationId)

  // 3. Calculer les scores par module via RPC
  const { data: moduleScores } = await supabase
    .rpc('get_module_scores', { p_evaluation_id: evaluationId })

  // 4. Créer le snapshot
  await supabase
    .from('evaluation_snapshots')
    .insert({
      evaluation_id: evaluationId,
      snapshot_by: user.id,
      scores: scores as any,
      module_scores: moduleScores ? JSON.parse(JSON.stringify(moduleScores)) : null,
    })

  revalidatePath(`/evaluator/evaluations/${evaluationId}`)
  revalidatePath('/workers')

  return { success: true }
}

/**
 * Récupère l'historique des snapshots d'une évaluation.
 */
export async function getSnapshotHistory(
  evaluationId: string
): Promise<SnapshotHistoryEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_snapshot_history', { p_evaluation_id: evaluationId })

  if (error) {
    console.error('Error fetching snapshot history:', error)
    return []
  }

  return (data ?? []) as SnapshotHistoryEntry[]
}
