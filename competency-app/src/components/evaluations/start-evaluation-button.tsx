'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getOrCreateContinuousEvaluation } from '@/lib/actions/evaluations'

interface StartEvaluationButtonProps {
  workerId: string
  jobProfileId?: string | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function StartEvaluationButton({
  workerId,
  jobProfileId,
  variant = 'default',
  size = 'default',
  className,
}: StartEvaluationButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)

    try {
      const result = await getOrCreateContinuousEvaluation(workerId, jobProfileId)

      if ('error' in result) {
        toast.error(result.error)
        setLoading(false)
        return
      }

      router.push(`/evaluator/evaluations/${result.evaluationId}`)
    } catch {
      toast.error('Erreur lors du chargement')
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Pencil className="h-4 w-4 mr-2" />
      )}
      {loading ? 'Chargement...' : 'Modifier les scores'}
    </Button>
  )
}
