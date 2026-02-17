'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { EvaluationCommentWithAuthor } from '@/lib/types'

export async function getComments(evaluationId: string): Promise<EvaluationCommentWithAuthor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('evaluation_comments')
    .select(`
      *,
      author:profiles!evaluation_comments_author_id_fkey(first_name, last_name, role)
    `)
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching comments:', error)
    return []
  }

  return (data ?? []) as EvaluationCommentWithAuthor[]
}

export async function addComment(evaluationId: string, content: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['skill_master', 'manager', 'super_admin'].includes(profile.role)) {
    return { error: 'Accès refusé. Seuls les skill masters, managers et admins peuvent commenter.' }
  }

  if (!content || content.trim().length === 0) {
    return { error: 'Le commentaire ne peut pas être vide.' }
  }

  const { error } = await supabase
    .from('evaluation_comments')
    .insert({
      evaluation_id: evaluationId,
      author_id: user.id,
      content: content.trim(),
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/evaluator/evaluations/${evaluationId}`)
  revalidatePath(`/evaluator/evaluations/${evaluationId}/results`)
  return { success: true }
}
