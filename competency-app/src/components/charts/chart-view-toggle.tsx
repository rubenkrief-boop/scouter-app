'use client'

import { useState, lazy, Suspense } from 'react'
import { CompetencyRadarChart } from './radar-chart'
import { Loader2 } from 'lucide-react'
import type { RadarDataPoint } from '@/lib/types'

// Lazy-load 3D views (Three.js is heavy)
const SphereRadar = lazy(() => import('./sphere-radar').then(mod => ({ default: mod.SphereRadar })))
const SkylineRadar = lazy(() => import('./skyline-radar').then(mod => ({ default: mod.SkylineRadar })))
const FlowerRadar = lazy(() => import('./flower-radar').then(mod => ({ default: mod.FlowerRadar })))
const ConstellationRadar = lazy(() => import('./constellation-radar').then(mod => ({ default: mod.ConstellationRadar })))
const TerrainRadar = lazy(() => import('./terrain-radar').then(mod => ({ default: mod.TerrainRadar })))

type ViewMode = '2d' | 'sphere' | 'skyline' | 'flower' | 'constellation' | 'terrain'

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: '2d', label: 'Radar 2D' },
  { key: 'skyline', label: 'Skyline' },
  { key: 'flower', label: 'Fleur' },
  { key: 'constellation', label: 'Constellation' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'sphere', label: 'Sphere' },
]

interface ChartViewToggleProps {
  data: RadarDataPoint[]
  colors?: { actual: string; expected: string }
  fullSize?: boolean
}

function Loader() {
  return (
    <div className="flex flex-col items-center justify-center h-[600px] gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Chargement de la vue 3D...</p>
    </div>
  )
}

export function ChartViewToggle({ data, colors, fullSize = false }: ChartViewToggleProps) {
  const [view, setView] = useState<ViewMode>('2d')

  return (
    <div>
      {/* Toggle buttons */}
      <div className="flex justify-end mb-2 px-2">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5 gap-0.5">
          {VIEW_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                view === opt.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart content */}
      {view === '2d' && (
        <CompetencyRadarChart
          data={data}
          expectedLabel="Attendu"
          actualLabel="Niveau actuel"
          colors={colors}
          fullSize={fullSize}
        />
      )}

      {view === 'sphere' && (
        <Suspense fallback={<Loader />}>
          <SphereRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}

      {view === 'skyline' && (
        <Suspense fallback={<Loader />}>
          <SkylineRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}

      {view === 'flower' && (
        <Suspense fallback={<Loader />}>
          <FlowerRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}

      {view === 'constellation' && (
        <Suspense fallback={<Loader />}>
          <ConstellationRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}

      {view === 'terrain' && (
        <Suspense fallback={<Loader />}>
          <TerrainRadar data={data} colors={colors} height={fullSize ? 800 : 600} />
        </Suspense>
      )}
    </div>
  )
}
