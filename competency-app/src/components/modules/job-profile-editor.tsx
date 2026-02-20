'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { JobProfile, Module, Competency, JobProfileCompetency, JobProfileCompetencySetting, QualifierWithOptions } from '@/lib/types'

interface JobProfileEditorProps {
  jobProfile: JobProfile
  modules: Module[]
  competencies: Competency[]
  expectedScores: JobProfileCompetency[]
  competencySettings: JobProfileCompetencySetting[]
  qualifiers?: QualifierWithOptions[]
  linkedQualifierIds?: string[]
}

interface CompetencySetting {
  weight: number
  expected_score: number
}

export function JobProfileEditor({
  jobProfile,
  modules,
  competencies,
  expectedScores,
  competencySettings,
  qualifiers = [],
  linkedQualifierIds = [],
}: JobProfileEditorProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Selected modules (included in this job profile)
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() => {
    return new Set(expectedScores.map(es => es.module_id))
  })

  // Selected qualifiers for this job profile
  const [selectedQualifiers, setSelectedQualifiers] = useState<Set<string>>(() => {
    return new Set(linkedQualifierIds)
  })

  // Per-competency settings
  const [settings, setSettings] = useState<Record<string, CompetencySetting>>(() => {
    const map: Record<string, CompetencySetting> = {}
    competencySettings.forEach(cs => {
      map[cs.competency_id] = { weight: cs.weight, expected_score: cs.expected_score }
    })
    return map
  })

  // Expanded modules - auto-expand selected modules so expected scores are visible
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    return new Set(expectedScores.map(es => es.module_id))
  })

  // Group competencies by module
  const competenciesByModule = useMemo(() => {
    const map: Record<string, Competency[]> = {}
    for (const c of competencies) {
      if (!map[c.module_id]) map[c.module_id] = []
      map[c.module_id].push(c)
    }
    return map
  }, [competencies])

  // Qualifier selection helpers
  function toggleQualifierSelection(qualifierId: string) {
    setSelectedQualifiers(prev => {
      const next = new Set(prev)
      if (next.has(qualifierId)) next.delete(qualifierId)
      else next.add(qualifierId)
      return next
    })
  }

  // Module selection helpers
  function toggleModuleSelection(moduleId: string) {
    setSelectedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  function selectAllModules() {
    setSelectedModules(new Set(modules.map(m => m.id)))
  }

  function deselectAllModules() {
    setSelectedModules(new Set())
  }

  function toggleModule(moduleId: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  function expandAll() {
    setExpandedModules(new Set(modules.map(m => m.id)))
  }

  function collapseAll() {
    setExpandedModules(new Set())
  }

  function getCompetencySetting(competencyId: string): CompetencySetting {
    return settings[competencyId] ?? { weight: 1, expected_score: 70 }
  }

  function updateSetting(competencyId: string, field: keyof CompetencySetting, value: number) {
    setSettings(prev => ({
      ...prev,
      [competencyId]: {
        ...getCompetencySetting(competencyId),
        [field]: value,
      },
    }))
  }

  // Calculate module average expected score from competency settings
  function getModuleAverage(moduleId: string): number {
    const comps = competenciesByModule[moduleId] ?? []
    if (comps.length === 0) return 0
    let totalWeight = 0
    let weightedScore = 0
    for (const c of comps) {
      const s = getCompetencySetting(c.id)
      totalWeight += s.weight
      weightedScore += s.expected_score * s.weight
    }
    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    try {
      // 1. Delete module entries for unselected modules
      const unselectedModuleIds = modules
        .filter(m => !selectedModules.has(m.id))
        .map(m => m.id)

      if (unselectedModuleIds.length > 0) {
        await supabase
          .from('job_profile_competencies')
          .delete()
          .eq('job_profile_id', jobProfile.id)
          .in('module_id', unselectedModuleIds)

        // Also delete competency settings for unselected modules
        const unselectedCompIds = competencies
          .filter(c => unselectedModuleIds.includes(c.module_id))
          .map(c => c.id)
        if (unselectedCompIds.length > 0) {
          await supabase
            .from('job_profile_competency_settings')
            .delete()
            .eq('job_profile_id', jobProfile.id)
            .in('competency_id', unselectedCompIds)
        }
      }

      // 2. Batch upsert selected modules
      const selectedModuleEntries = modules
        .filter(m => selectedModules.has(m.id))
        .map(m => ({
          job_profile_id: jobProfile.id,
          module_id: m.id,
          expected_score: getModuleAverage(m.id),
        }))

      if (selectedModuleEntries.length > 0) {
        await supabase
          .from('job_profile_competencies')
          .upsert(selectedModuleEntries, { onConflict: 'job_profile_id,module_id' })
      }

      // 3. Batch upsert competency settings for selected modules only
      const selectedCompEntries = competencies
        .filter(c => selectedModules.has(c.module_id))
        .map(c => {
          const s = getCompetencySetting(c.id)
          return {
            job_profile_id: jobProfile.id,
            competency_id: c.id,
            weight: s.weight,
            expected_score: s.expected_score,
          }
        })

      if (selectedCompEntries.length > 0) {
        await supabase
          .from('job_profile_competency_settings')
          .upsert(selectedCompEntries, { onConflict: 'job_profile_id,competency_id' })
      }

      // 4. Save qualifier selections
      // Delete all existing links for this profile
      await supabase
        .from('job_profile_qualifiers')
        .delete()
        .eq('job_profile_id', jobProfile.id)

      // Insert selected qualifiers
      if (selectedQualifiers.size > 0) {
        const qualifierEntries = Array.from(selectedQualifiers).map(qId => ({
          job_profile_id: jobProfile.id,
          qualifier_id: qId,
        }))
        await supabase
          .from('job_profile_qualifiers')
          .insert(qualifierEntries)
      }

      toast.success('Profil metier enregistre')
      router.refresh()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    }

    setSaving(false)
  }

  const selectedCount = selectedModules.size
  const totalCount = modules.length

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link href="/skill-master/job-profiles" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Retour aux profils metier
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={selectAllModules}>
            Tout selectionner
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAllModules}>
            Tout deselectionner
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll}>
            Tout deplier
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Tout replier
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      {/* Selection summary */}
      <div className="text-sm text-muted-foreground">
        {selectedCount} / {totalCount} modules selectionnes pour ce profil metier
      </div>

      {/* Qualifier selection */}
      {qualifiers.length > 0 && (
        <Card>
          <div className="px-6 py-4">
            <h3 className="font-semibold text-sm mb-1">Qualifiers (critères d&apos;évaluation)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sélectionnez les qualifiers utilisés pour ce profil métier. Si aucun n&apos;est sélectionné, tous les qualifiers actifs seront utilisés.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {qualifiers.map((qualifier) => {
                const isSelected = selectedQualifiers.has(qualifier.id)
                const optionCount = qualifier.qualifier_options?.length ?? 0
                return (
                  <button
                    key={qualifier.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-rose-300 bg-rose-50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                    onClick={() => toggleQualifierSelection(qualifier.id)}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className={cn('font-medium text-sm', isSelected ? 'text-rose-700' : 'text-slate-700')}>
                        {qualifier.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {optionCount} option{optionCount > 1 ? 's' : ''}
                        {qualifier.qualifier_options?.slice(0, 3).map(o => o.label).join(', ')}
                        {optionCount > 3 ? '...' : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
            {selectedQualifiers.size > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {selectedQualifiers.size} / {qualifiers.length} qualifier{selectedQualifiers.size > 1 ? 's' : ''} sélectionné{selectedQualifiers.size > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Modules list */}
      <div className="space-y-3">
        {modules.map((module) => {
          const isIncluded = selectedModules.has(module.id)
          const isExpanded = expandedModules.has(module.id)
          const comps = competenciesByModule[module.id] ?? []
          const avgScore = isIncluded ? getModuleAverage(module.id) : 0

          return (
            <Card key={module.id} className={cn(!isIncluded && 'opacity-50')}>
              {/* Module header - clickable */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => {
                  if (isIncluded) toggleModule(module.id)
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleModuleSelection(module.id)
                    }}
                  >
                    {isIncluded ? (
                      <CheckSquare className="h-5 w-5 text-rose-600" />
                    ) : (
                      <Square className="h-5 w-5 text-slate-300" />
                    )}
                  </button>

                  {isIncluded && (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )
                  )}
                  <span className="text-lg">{module.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">
                      {module.code} - {module.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comps.length} competence{comps.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {isIncluded && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-48">
                      <Progress value={avgScore} className="h-2 flex-1" />
                      <Badge variant="secondary" className="text-xs min-w-[40px] justify-center">
                        {avgScore}%
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Competencies table - expandable, only if included */}
              {isIncluded && isExpanded && comps.length > 0 && (
                <CardContent className="pt-0 pb-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Competence</TableHead>
                        <TableHead className="w-24 text-xs text-center">Poids</TableHead>
                        <TableHead className="w-32 text-xs text-center">Score attendu (%)</TableHead>
                        <TableHead className="w-32 text-xs">Progression</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comps.map((comp) => {
                        const s = getCompetencySetting(comp.id)
                        return (
                          <TableRow key={comp.id}>
                            <TableCell className="text-sm">{comp.name}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                className="w-16 h-7 text-center text-sm mx-auto"
                                value={s.weight}
                                onChange={(e) => updateSetting(comp.id, 'weight', Math.max(1, parseInt(e.target.value) || 1))}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                className="w-20 h-7 text-center text-sm mx-auto"
                                value={s.expected_score}
                                onChange={(e) => updateSetting(comp.id, 'expected_score', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={s.expected_score} className="h-1.5 flex-1" />
                                <span className="text-xs text-muted-foreground w-8">
                                  {s.expected_score}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}

              {isIncluded && isExpanded && comps.length === 0 && (
                <CardContent className="pt-0 pb-4">
                  <p className="text-sm text-muted-foreground italic">
                    Aucune competence dans ce module
                  </p>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
