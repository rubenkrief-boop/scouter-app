'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { RadarDataPoint } from '@/lib/types'

const DEFAULT_COLORS = {
  actual: '#8b5cf6',
  expected: '#9ca3af',
}

interface ChartColors {
  actual: string
  expected: string
}

interface CompetencyRadarChartProps {
  data: RadarDataPoint[]
  expectedLabel?: string
  actualLabel?: string
  colors?: ChartColors
}

/**
 * Catmull-Rom spline interpolation for smooth radar curves
 */
function catmullRomSpline(points: { x: number; y: number }[], tension = 0.5): string {
  if (points.length < 3) return ''

  // Close the loop
  const pts = [...points, points[0], points[1]]

  let path = `M ${points[0].x},${points[0].y}`

  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const p2 = pts[i + 2]
    const p3 = pts[i + 3]

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  return path + ' Z'
}

/**
 * Custom smooth radar shape using Catmull-Rom splines
 */
function SmoothRadarShape({
  points,
  stroke,
  fill,
  fillOpacity,
  strokeWidth,
}: {
  points: { x: number; y: number }[]
  stroke: string
  fill: string
  fillOpacity: number
  strokeWidth: number
}) {
  if (!points || points.length < 3) return null
  const path = catmullRomSpline(points, 0.5)
  return (
    <path
      d={path}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl border border-gray-700 min-w-[180px]">
      <p className="font-semibold text-sm mb-2 border-b border-gray-600 pb-1.5">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm py-0.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold ml-auto">{Number(entry.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null

  return (
    <div className="flex justify-center gap-6 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function CompetencyRadarChart({
  data,
  expectedLabel = 'Attendu',
  actualLabel = 'Actuel',
  colors,
}: CompetencyRadarChartProps) {
  const c = { ...DEFAULT_COLORS, ...colors }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  // Shorten module labels for display
  const chartData = data.map(d => ({
    ...d,
    shortModule: d.module.length > 25 ? d.module.slice(0, 22) + '...' : d.module,
  }))

  return (
    <ResponsiveContainer width="100%" height={500}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
        <PolarGrid
          stroke="var(--border)"
          strokeOpacity={0.4}
          gridType="circle"
        />
        <PolarAngleAxis
          dataKey="shortModule"
          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
          tickCount={6}
          axisLine={false}
        />
        {/* Expected (background) */}
        <Radar
          name={expectedLabel}
          dataKey="expected"
          stroke={c.expected}
          fill={c.expected}
          fillOpacity={0.12}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: c.expected, stroke: '#fff', strokeWidth: 2 }}
          shape={(props: any) => (
            <SmoothRadarShape
              points={props.points}
              stroke={c.expected}
              fill={c.expected}
              fillOpacity={0.12}
              strokeWidth={1.5}
            />
          )}
        />
        {/* Actual (primary) */}
        <Radar
          name={actualLabel}
          dataKey="actual"
          stroke={c.actual}
          fill={c.actual}
          fillOpacity={0.2}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
          shape={(props: any) => (
            <SmoothRadarShape
              points={props.points}
              stroke={c.actual}
              fill={c.actual}
              fillOpacity={0.2}
              strokeWidth={2.5}
            />
          )}
        />
        <Legend content={<CustomLegend />} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
