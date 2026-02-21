'use client'

import { useState, useEffect } from 'react'
import { Sliders, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { setModuleQualifiers } from '@/lib/actions/modules'

interface QualifierInfo {
  id: string
  name: string
  qualifier_type: string
  sort_order: number
}

interface ModuleQualifierEditorProps {
  moduleId: string
  moduleName: string
}

export function ModuleQualifierEditor({ moduleId, moduleName }: ModuleQualifierEditorProps) {
  const [allQualifiers, setAllQualifiers] = useState<QualifierInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadData()
  }, [moduleId])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    // Charger tous les qualifiers actifs
    const { data: qualifiers } = await supabase
      .from('qualifiers')
      .select('id, name, qualifier_type, sort_order')
      .eq('is_active', true)
      .order('sort_order')

    // Charger les qualifiers deja assignes a ce module
    const { data: moduleQuals } = await supabase
      .from('module_qualifiers')
      .select('qualifier_id')
      .eq('module_id', moduleId)

    const assignedIds = new Set((moduleQuals ?? []).map(mq => mq.qualifier_id))

    setAllQualifiers(qualifiers ?? [])
    setSelectedIds(assignedIds)
    setInitialIds(new Set(assignedIds))
    setLoading(false)
  }

  function toggleQualifier(qId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(qId)) {
        next.delete(qId)
      } else {
        next.add(qId)
      }
      return next
    })
  }

  const hasChanges = (() => {
    if (selectedIds.size !== initialIds.size) return true
    for (const id of selectedIds) {
      if (!initialIds.has(id)) return true
    }
    return false
  })()

  async function handleSave() {
    setSaving(true)
    const result = await setModuleQualifiers(moduleId, Array.from(selectedIds))
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Qualifiers mis a jour')
      setInitialIds(new Set(selectedIds))
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des qualifiers...
      </div>
    )
  }

  if (allQualifiers.length === 0) {
    return (
      <div className="py-4 px-4 text-sm text-muted-foreground">
        Aucun qualifier disponible. Creez-en d&apos;abord dans la section Qualifiers.
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Qualifiers du module
            </h4>
            {selectedIds.size === 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                Tous par defaut
              </Badge>
            )}
          </div>
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700 h-7 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Enregistrer
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Selectionnez les qualifiers utilises pour evaluer ce module.
          Si aucun n&apos;est selectionne, tous les qualifiers actifs seront proposes.
        </p>

        <div className="flex flex-wrap gap-2">
          {allQualifiers.map(q => {
            const isSelected = selectedIds.has(q.id)
            return (
              <button
                key={q.id}
                onClick={() => toggleQualifier(q.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-150 border cursor-pointer
                  ${isSelected
                    ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800'
                  }
                `}
              >
                {isSelected && <Check className="h-3 w-3" />}
                {q.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
