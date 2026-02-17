'use client'

import { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import type { RadarDataPoint } from '@/lib/types'

const DEFAULT_COLORS = {
  actual: '#8b5cf6',
  expected: '#9ca3af',
}

const PREVIEW_DATA: RadarDataPoint[] = [
  { module: 'Module A', actual: 85, expected: 70, fullMark: 100 },
  { module: 'Module B', actual: 60, expected: 80, fullMark: 100 },
  { module: 'Module C', actual: 90, expected: 75, fullMark: 100 },
  { module: 'Module D', actual: 45, expected: 65, fullMark: 100 },
  { module: 'Module E', actual: 70, expected: 70, fullMark: 100 },
]

export function ChartColorsEditor() {
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/settings?key=chart_colors')
      .then(r => r.json())
      .then(data => {
        if (data.value) {
          setColors({ ...DEFAULT_COLORS, ...data.value })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'chart_colors', value: colors }),
      })
      if (res.ok) {
        toast.success('Couleurs enregistrées')
      } else {
        toast.error("Erreur lors de l'enregistrement")
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    }
    setSaving(false)
  }

  function handleReset() {
    setColors(DEFAULT_COLORS)
  }

  if (!loaded) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Color pickers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Couleurs des courbes du radar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <Label className="w-40">Courbe actuelle</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colors.actual}
                  onChange={(e) => setColors(prev => ({ ...prev, actual: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-sm text-muted-foreground font-mono">{colors.actual}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label className="w-40">Courbe attendue</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colors.expected}
                  onChange={(e) => setColors(prev => ({ ...prev, expected: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-sm text-muted-foreground font-mono">{colors.expected}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          <CompetencyRadarChart
            data={PREVIEW_DATA}
            expectedLabel="Attendu"
            actualLabel="Actuel"
            colors={colors}
          />
        </CardContent>
      </Card>
    </div>
  )
}
