'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Profile, JobProfile } from '@/lib/types'

interface NewEvaluationFormProps {
  workers: Profile[]
  jobProfiles: JobProfile[]
}

export function NewEvaluationForm({ workers, jobProfiles }: NewEvaluationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [audioId, setAudioId] = useState('')
  const [jobProfileId, setJobProfileId] = useState('')
  const [title, setTitle] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!audioId) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // 1. Create the new evaluation
    const { data: newEval, error } = await supabase
      .from('evaluations')
      .insert({
        evaluator_id: user.id,
        audioprothesiste_id: audioId,
        job_profile_id: jobProfileId || null,
        title: title || null,
        status: 'draft',
      })
      .select()
      .single()

    if (error || !newEval) {
      toast.error("Erreur lors de la création")
      setLoading(false)
      return
    }

    // 2. Pre-fill from the audioprothesiste's latest evaluation
    try {
      let query = supabase
        .from('evaluations')
        .select('id')
        .eq('audioprothesiste_id', audioId)
        .neq('id', newEval.id)
        .order('evaluated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)

      if (jobProfileId) {
        query = query.eq('job_profile_id', jobProfileId)
      }

      const { data: prevEvals } = await query

      if (prevEvals && prevEvals.length > 0) {
        const prevEvalId = prevEvals[0].id

        // Fetch previous results with qualifiers
        const { data: prevResults } = await supabase
          .from('evaluation_results')
          .select('*, evaluation_result_qualifiers(*)')
          .eq('evaluation_id', prevEvalId)

        if (prevResults && prevResults.length > 0) {
          // Batch insert all evaluation results at once
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

            // Batch insert all qualifier answers at once
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
          toast.success('Evaluation creee avec les scores precedents')
        }
      }
    } catch {
      console.warn('Pre-fill from previous evaluation failed')
    }

    router.push(`/evaluator/evaluations/${newEval.id}/results`)
    setLoading(false)
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Créer une évaluation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Collaborateur *</Label>
            <Select value={audioId} onValueChange={setAudioId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {workers.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.first_name} {a.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Profil métier</Label>
            <Select value={jobProfileId} onValueChange={setJobProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {jobProfiles.map((jp) => (
                  <SelectItem key={jp.id} value={jp.id}>
                    {jp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Titre (optionnel)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Évaluation trimestrielle" />
          </div>
          <p className="text-xs text-muted-foreground">
            Si une évaluation précédente existe, les scores seront pré-remplis automatiquement.
          </p>
          <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading || !audioId}>
            {loading ? 'Création...' : 'Créer l\'évaluation'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
