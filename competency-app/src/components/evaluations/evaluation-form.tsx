'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, BarChart3 } from 'lucide-react'
import { getIconOption } from '@/lib/utils-app/qualifier-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Module, Competency, QualifierWithOptions } from '@/lib/types'

interface EvaluationFormProps {
  evaluationId: string
  evaluationStatus: string
  modules: (Module & { competencies: Competency[] })[]
  qualifiers: QualifierWithOptions[]
  qualifiersByModule?: Record<string, QualifierWithOptions[]>
  initialState: Record<string, Record<string, string>>
  readOnly?: boolean
}

function QualifierIcon({ icon }: { icon: string | null }) {
  const iconOption = getIconOption(icon)
  if (!iconOption) return null
  const IconComp = iconOption.icon
  return <IconComp className={`h-4 w-4 ${iconOption.color ?? 'text-gray-500'}`} />
}

export function EvaluationForm({
  evaluationId,
  evaluationStatus,
  modules,
  qualifiers,
  qualifiersByModule,
  initialState,
  readOnly = false,
}: EvaluationFormProps) {
  const router = useRouter()
  const [state, setState] = useState(initialState)
  const [saving, setSaving] = useState(false)

  function handleChange(competencyId: string, qualifierId: string, optionId: string) {
    setState(prev => ({
      ...prev,
      [competencyId]: {
        ...(prev[competencyId] ?? {}),
        [qualifierId]: optionId,
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      // 1. Update evaluation status
      await supabase
        .from('evaluations')
        .update({
          status: 'in_progress',
          evaluated_at: new Date().toISOString(),
        })
        .eq('id', evaluationId)

      // 2. Batch upsert all evaluation_results at once
      const competencyIds = Object.keys(state)
      const resultRows = competencyIds.map(cid => ({
        evaluation_id: evaluationId,
        competency_id: cid,
      }))

      if (resultRows.length > 0) {
        const { data: upsertedResults } = await supabase
          .from('evaluation_results')
          .upsert(resultRows, { onConflict: 'evaluation_id,competency_id' })
          .select('id, competency_id')

        if (upsertedResults) {
          // Build map: competency_id -> result_id
          const resultMap = new Map(upsertedResults.map(r => [r.competency_id, r.id]))

          // 3. Batch upsert all qualifier answers at once
          const qualifierRows: {
            evaluation_result_id: string
            qualifier_id: string
            qualifier_option_id: string
          }[] = []

          for (const [competencyId, qualifierAnswers] of Object.entries(state)) {
            const resultId = resultMap.get(competencyId)
            if (!resultId) continue
            for (const [qualifierId, optionId] of Object.entries(qualifierAnswers)) {
              if (!optionId) continue
              qualifierRows.push({
                evaluation_result_id: resultId,
                qualifier_id: qualifierId,
                qualifier_option_id: optionId,
              })
            }
          }

          if (qualifierRows.length > 0) {
            await supabase
              .from('evaluation_result_qualifiers')
              .upsert(qualifierRows, { onConflict: 'evaluation_result_id,qualifier_id' })
          }
        }
      }

      toast.success('Evaluation enregistree')
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    }

    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Action buttons — always visible */}
      <div className="flex gap-3 justify-end sticky top-0 z-10 bg-background py-3">
        <Link href={`/evaluator/evaluations/${evaluationId}/results`}>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            Voir les résultats
          </Button>
        </Link>
        {!readOnly && (
          <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        )}
      </div>

      {/* Competencies grouped by module */}
      {modules.map((module) => {
        if (!module.competencies || module.competencies.length === 0) return null

        // Utiliser les qualifiers specifiques au module si disponibles, sinon fallback global
        const moduleQualifiers = qualifiersByModule?.[module.id] ?? qualifiers

        return (
          <Card key={module.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{module.icon}</span>
                Module {module.code} - {module.name}
                <Badge variant="secondary" className="ml-auto">
                  {module.competencies.length} compétences
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Compétence</TableHead>
                      {moduleQualifiers.map((q) => (
                        <TableHead key={q.id} className="min-w-[140px] text-center">
                          {q.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {module.competencies
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((comp) => (
                        <TableRow key={comp.id}>
                          <TableCell className="font-medium text-sm">{comp.name}</TableCell>
                          {moduleQualifiers.map((qualifier) => {
                            const currentValue = state[comp.id]?.[qualifier.id] ?? ''
                            const selectedOption = qualifier.qualifier_options?.find(o => o.id === currentValue)

                            return (
                              <TableCell key={qualifier.id} className="text-center">
                                <Select
                                  value={currentValue}
                                  onValueChange={(v) => handleChange(comp.id, qualifier.id, v)}
                                  disabled={readOnly}
                                >
                                  <SelectTrigger className={`text-xs h-8 ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                    <SelectValue placeholder="-">
                                      {selectedOption && (
                                        <span className="flex items-center gap-1">
                                          {selectedOption.icon && <QualifierIcon icon={selectedOption.icon} />}
                                          {selectedOption.label}
                                        </span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {qualifier.qualifier_options
                                      ?.sort((a, b) => a.sort_order - b.sort_order)
                                      .map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                          <span className="flex items-center gap-2">
                                            {option.icon && <QualifierIcon icon={option.icon} />}
                                            {option.label}
                                          </span>
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
