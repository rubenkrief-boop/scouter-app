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

// eLamp-inspired: violet primary, gray secondary
const DEFAULT_COLORS = {
  actual: '#7c3aed',
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
  /** Show full-size chart (for dedicated pages) */
  fullSize?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl min-w-[220px] border border-gray-700">
      <p className="font-bold text-sm mb-2 border-b border-gray-700 pb-2">{label}</p>
      {payload.map((entry: any, index: number) => {
        const isActual = entry.dataKey === 'actual'
        return (
          <div key={index} className="flex items-center gap-2.5 text-sm py-1">
            <span
              className="inline-block w-3 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-400">{entry.name}</span>
            <span className={`font-bold ml-auto ${isActual ? 'text-violet-400' : 'text-gray-300'}`}>
              {Number(entry.value).toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CustomLegend({ payload }: any) {
  if (!payload?.length) return null

  return (
    <div className="flex justify-center gap-8 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2.5">
          <span
            className="inline-block w-5 h-1 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function CustomAngleAxisTick({ x, y, payload, cx, cy }: any) {
  const label: string = payload.value
  const dx = x - cx
  const dy = y - cy
  const angle = Math.atan2(dy, dx)
  const dist = 24

  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  const xOff = Math.cos(angle) * dist
  let yOff = Math.sin(angle) * dist

  if (Math.cos(angle) > 0.25) {
    textAnchor = 'start'
  } else if (Math.cos(angle) < -0.25) {
    textAnchor = 'end'
  }

  if (Math.sin(angle) < -0.5) yOff -= 6
  else if (Math.sin(angle) > 0.5) yOff += 6

  return (
    <text
      x={x + xOff}
      y={y + yOff}
      textAnchor={textAnchor}
      dominantBaseline="central"
      className="fill-gray-500 dark:fill-gray-400"
      fontSize={12}
      fontWeight={500}
    >
      {label}
    </text>
  )
}

export function CompetencyRadarChart({
  data,
  expectedLabel = 'Attendu',
  actualLabel = 'Niveau actuel',
  colors,
  fullSize = false,
}: CompetencyRadarChartProps) {
  const c = { ...DEFAULT_COLORS, ...colors }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Aucune donnée disponible
      </div>
    )
  }

  // Use full module names like eLamp (not codes)
  const chartData = data.map(d => {
    const parts = d.module.split(' - ')
    const name = parts[1]?.trim() || parts[0]?.trim() || d.module
    return { ...d, label: name }
  })

  const count = chartData.length
  // Full size: take up most of the page like eLamp
  const chartHeight = fullSize ? 750 : (count > 15 ? 520 : 480)
  const outerRadius = fullSize
    ? (count > 15 ? '78%' : '82%')
    : (count > 15 ? '65%' : '72%')

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={chartData}>
        <defs>
          <radialGradient id="actualGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c.actual} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.actual} stopOpacity={0.15} />
          </radialGradient>
          <radialGradient id="expectedGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c.expected} stopOpacity={0.2} />
            <stop offset="100%" stopColor={c.expected} stopOpacity={0.08} />
          </radialGradient>
        </defs>
        {/* Circular grid like eLamp */}
        <PolarGrid
          stroke="#d1d5db"
          strokeOpacity={0.6}
          gridType="circle"
          radialLines={true}
        />
        <PolarAngleAxis
          dataKey="label"
          tick={(props: any) => <CustomAngleAxisTick {...props} />}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          tickCount={6}
          axisLine={false}
        />
        {/* Expected (background - gray, solid thin) */}
        <Radar
          name={expectedLabel}
          dataKey="expected"
          stroke={c.expected}
          fill="url(#expectedGradient)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: c.expected, stroke: '#fff', strokeWidth: 2 }}
        />
        {/* Actual (primary - violet bold, eLamp style) */}
        <Radar
          name={actualLabel}
          dataKey="actual"
          stroke={c.actual}
          fill="url(#actualGradient)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
        />
        <Legend content={<CustomLegend />} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
