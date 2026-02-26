'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Pencil, Loader2, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { getOrCreateContinuousEvaluation } from '@/lib/actions/evaluations'

interface ModuleScoreData {
  module_id: string
  module_code: string
  module_name: string
  completion_pct: number
}

interface ExpectedScoreData {
  module_id: string
  expected_score: number
}

interface WorkerJobProfileCardProps {
  workerId: string
  profileId: string
  profileName: string
  moduleScores: ModuleScoreData[]
  expectedScores: ExpectedScoreData[]
  hasEvaluation: boolean
  hasModulesConfigured: boolean
}

export function WorkerJobProfileCard({
  workerId,
  profileId,
  profileName,
  moduleScores,
  expectedScores,
  hasEvaluation,
  hasModulesConfigured,
}: WorkerJobProfileCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(false)

  const avgScore = moduleScores.length > 0
    ? Math.round(moduleScores.reduce((sum, ms) => sum + (parseFloat(String(ms.completion_pct)) || 0), 0) / moduleScores.length)
    : 0

  const expectedMap = new Map(expectedScores.map(es => [es.module_id, es.expected_score]))
  const modulesValidated = moduleScores.filter(ms => {
    const expected = expectedMap.get(ms.module_id) ?? 0
    return expected > 0 && (parseFloat(String(ms.completion_pct)) || 0) >= expected
  }).length
  const modulesWithExpected = expectedScores.filter(es => es.expected_score > 0).length

  async function handleEvaluate() {
    setLoading(true)
    try {
      const result = await getOrCreateContinuousEvaluation(workerId, profileId)
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

  async function handleRemove() {
    if (!confirm(`Retirer le profil « ${profileName} » de ce collaborateur ?`)) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/workers/${workerId}/job-profiles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobProfileId: profileId }),
      })
      if (res.ok) {
        toast.success(`Profil « ${profileName} » retiré`)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'Erreur lors de la suppression')
      }
    } catch {
      toast.error('Erreur réseau')
    }
    setRemoving(false)
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold text-sm">{profileName}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-500"
            onClick={handleRemove}
            disabled={removing}
            title="Retirer ce profil"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Content */}
        {!hasModulesConfigured ? (
          <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 rounded-md p-3 mb-3">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />
            Aucun module de compétence rattaché à ce profil. Configurez-le dans la gestion des profils métier.
          </div>
        ) : hasEvaluation ? (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Score moyen</span>
              <span className="font-medium text-foreground">{avgScore}%</span>
            </div>
            <Progress value={avgScore} className="h-2 mb-3" />

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs">
              {modulesWithExpected > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  {modulesValidated}/{modulesWithExpected} validés
                </span>
              )}
              {modulesWithExpected > 0 && modulesValidated < modulesWithExpected && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  {modulesWithExpected - modulesValidated} à améliorer
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground mb-3">Pas encore évalué sur ce profil</p>
        )}

        {/* Action button */}
        <Button
          onClick={handleEvaluate}
          disabled={loading || !hasModulesConfigured}
          size="sm"
          className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Pencil className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Chargement...' : 'Modifier les scores'}
        </Button>
      </CardContent>
    </Card>
  )
}
