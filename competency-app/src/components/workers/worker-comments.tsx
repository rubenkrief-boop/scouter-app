'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Send, Loader2, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { addWorkerComment } from '@/lib/actions/worker-comments'
import type { WorkerCommentWithAuthor } from '@/lib/types'

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRoleBadge(role: string): string {
  switch (role) {
    case 'super_admin': return 'Admin'
    case 'skill_master': return 'Skill Master'
    case 'manager': return 'Manager'
    default: return role
  }
}

interface WorkerCommentsProps {
  workerId: string
  comments: WorkerCommentWithAuthor[]
}

export function WorkerComments({ workerId, comments: initialComments }: WorkerCommentsProps) {
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!content.trim()) return

    startTransition(async () => {
      const result = await addWorkerComment(workerId, content)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Bilan ajouté')
      setComments(prev => [{
        id: crypto.randomUUID(),
        worker_id: workerId,
        author_id: '',
        content: content.trim(),
        created_at: new Date().toISOString(),
        author: { first_name: 'Vous', last_name: '', role: '' },
      }, ...prev])
      setContent('')
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-500" />
          Bilans et commentaires
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulaire d'ajout */}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ajouter un bilan ou commentaire..."
            className="flex-1 min-h-[80px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isPending}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !content.trim()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isPending ? 'Envoi...' : 'Ajouter un bilan'}
          </Button>
        </div>

        {/* Liste des commentaires */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun bilan pour le moment</p>
            <p className="text-xs mt-1">Ajoutez un commentaire pour suivre la progression de ce collaborateur</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">
                      {comment.author?.first_name} {comment.author?.last_name}
                    </span>
                    {comment.author?.role && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium">
                        {getRoleBadge(comment.author.role)}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground flex-shrink-0">
                    {formatDateTime(comment.created_at)}
                  </time>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap pl-9">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
