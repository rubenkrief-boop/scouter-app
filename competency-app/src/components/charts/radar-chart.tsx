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
  actual: '#6366f1',
  expected: '#94a3b8',
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
    <div className="bg-white dark:bg-gray-900 px-4 py-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 min-w-[180px]">
      <p className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">{label}</p>
      {payload.map((entry: any, index: number) => {
        const isActual = entry.dataKey === 'actual'
        return (
          <div key={index} className="flex items-center gap-2 text-sm py-0.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-500 dark:text-gray-400">{entry.name}</span>
            <span className={`font-bold ml-auto ${isActual ? 'text-indigo-600' : 'text-gray-400'}`}>
              {Math.round(Number(entry.value))}%
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
    <div className="flex justify-center gap-6 mt-2">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{
              backgroundColor: entry.color,
              boxShadow: `0 0 0 2px white, 0 0 0 3px ${entry.color}50`,
            }}
          />
          <span className="font-medium text-gray-600 dark:text-gray-300">{entry.value}</span>
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
  const dist = 14

  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  const xOff = Math.cos(angle) * dist
  let yOff = Math.sin(angle) * dist

  if (Math.cos(angle) > 0.3) {
    textAnchor = 'start'
  } else if (Math.cos(angle) < -0.3) {
    textAnchor = 'end'
  }

  if (Math.sin(angle) < -0.5) yOff -= 4
  else if (Math.sin(angle) > 0.5) yOff += 4

  return (
    <text
      x={x + xOff}
      y={y + yOff}
      textAnchor={textAnchor}
      dominantBaseline="central"
      className="fill-gray-600 dark:fill-gray-400"
      fontSize={12}
      fontWeight={600}
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

  // Use module CODE only (e.g. "M1", "M2") for clean labels
  const chartData = data.map(d => {
    const parts = d.module.split(' - ')
    const code = parts[0]?.trim() || d.module
    return { ...d, label: code }
  })

  const count = chartData.length
  // Full size: much bigger chart for dedicated views
  const chartHeight = fullSize ? 620 : (count > 15 ? 480 : 440)
  const outerRadius = fullSize
    ? (count > 15 ? '70%' : '75%')
    : (count > 15 ? '60%' : '68%')

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={chartData}>
        <defs>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.actual} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.actual} stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.expected} stopOpacity={0.15} />
            <stop offset="100%" stopColor={c.expected} stopOpacity={0.02} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <PolarGrid
          stroke="var(--border)"
          strokeOpacity={0.2}
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="label"
          tick={(props: any) => <CustomAngleAxisTick {...props} />}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
          tickCount={5}
          axisLine={false}
          tickFormatter={(value: number) => `${value}`}
        />
        {/* Expected (background - dashed) */}
        <Radar
          name={expectedLabel}
          dataKey="expected"
          stroke={c.expected}
          fill="url(#expectedGradient)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 4, fill: c.expected, stroke: '#fff', strokeWidth: 2 }}
        />
        {/* Actual (primary with glow) */}
        <Radar
          name={actualLabel}
          dataKey="actual"
          stroke={c.actual}
          fill="url(#actualGradient)"
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
          filter="url(#glow)"
        />
        <Legend content={<CustomLegend />} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
