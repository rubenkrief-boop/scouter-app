'use client'

import { CompetencyRadarChart } from './radar-chart'
import type { RadarDataPoint } from '@/lib/types'

interface ChartViewToggleProps {
  data: RadarDataPoint[]
  colors?: { actual: string; expected: string }
  fullSize?: boolean
}

export function ChartViewToggle({ data, colors, fullSize = false }: ChartViewToggleProps) {
  return (
    <CompetencyRadarChart
      data={data}
      expectedLabel="Attendu"
      actualLabel="Niveau actuel"
      colors={colors}
      fullSize={fullSize}
    />
  )
}
