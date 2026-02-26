'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { WorkerCommentWithAuthor } from '@/lib/types'

export async function getWorkerComments(workerId: string): Promise<WorkerCommentWithAuthor[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('worker_comments')
    .select(`
      *,
      author:profiles!worker_comments_author_id_fkey(first_name, last_name, role)
    `)
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching worker comments:', error)
    return []
  }

  return (data ?? []) as WorkerCommentWithAuthor[]
}

export async function addWorkerComment(workerId: string, content: string) {
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
    .from('worker_comments')
    .insert({
      worker_id: workerId,
      author_id: user.id,
      content: content.trim(),
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/workers/${workerId}`)
  return { success: true }
}
