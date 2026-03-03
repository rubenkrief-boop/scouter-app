'use client'

import { useState, lazy, Suspense } from 'react'
import { CompetencyRadarChart } from './radar-chart'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { RadarDataPoint } from '@/lib/types'

// Lazy-load the 3D sphere (heavy dependency — three.js)
const SphereRadar = lazy(() =>
  import('./sphere-radar').then(mod => ({ default: mod.SphereRadar }))
)

interface ChartViewToggleProps {
  data: RadarDataPoint[]
  colors?: { actual: string; expected: string }
  fullSize?: boolean
}

export function ChartViewToggle({ data, colors, fullSize = false }: ChartViewToggleProps) {
  const [view, setView] = useState<'2d' | '3d'>('2d')

  return (
    <div>
      {/* Toggle buttons */}
      <div className="flex justify-end mb-2 px-2">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5">
          <button
            onClick={() => setView('2d')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === '2d'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Radar 2D
          </button>
          <button
            onClick={() => setView('3d')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              view === '3d'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Sphere 3D
          </button>
        </div>
      </div>

      {/* Chart content */}
      {view === '2d' ? (
        <CompetencyRadarChart
          data={data}
          expectedLabel="Attendu"
          actualLabel="Niveau actuel"
          colors={colors}
          fullSize={fullSize}
        />
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center h-[600px] gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Chargement de la vue 3D...</p>
            </div>
          }
        >
          <SphereRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}
    </div>
  )
}
