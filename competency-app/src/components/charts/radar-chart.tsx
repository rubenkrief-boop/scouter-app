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
  expected: '#e2e8f0',
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white dark:bg-gray-900 px-4 py-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 min-w-[200px]">
      <p className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">{label}</p>
      {payload.map((entry: any, index: number) => {
        const isActual = entry.dataKey === 'actual'
        return (
          <div key={index} className="flex items-center gap-2.5 text-sm py-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
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
    <div className="flex justify-center gap-8 mt-6">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2.5 text-sm">
          <span
            className="inline-block w-3 h-3 rounded-full ring-2 ring-offset-2"
            style={{ backgroundColor: entry.color, boxShadow: `0 0 0 2px white, 0 0 0 4px ${entry.color}40` }}
          />
          <span className="font-medium text-gray-600 dark:text-gray-300">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function CustomAngleAxisTick({ x, y, payload, cx, cy }: any) {
  const label = payload.value
  const maxLen = 18
  const display = label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label

  // Position text based on angle relative to center
  const dx = x - cx
  const dy = y - cy
  const angle = Math.atan2(dy, dx)

  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  let xOffset = 0
  let yOffset = 0

  if (Math.cos(angle) > 0.3) {
    textAnchor = 'start'
    xOffset = 6
  } else if (Math.cos(angle) < -0.3) {
    textAnchor = 'end'
    xOffset = -6
  }

  if (Math.sin(angle) > 0.3) {
    yOffset = 12
  } else if (Math.sin(angle) < -0.3) {
    yOffset = -6
  }

  return (
    <text
      x={x + xOffset}
      y={y + yOffset}
      textAnchor={textAnchor}
      className="fill-gray-500 dark:fill-gray-400"
      fontSize={11}
      fontWeight={500}
    >
      {display}
    </text>
  )
}

export function CompetencyRadarChart({
  data,
  expectedLabel = 'Attendu',
  actualLabel = 'Niveau actuel',
  colors,
}: CompetencyRadarChartProps) {
  const c = { ...DEFAULT_COLORS, ...colors }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-muted-foreground">
        Aucune donnee disponible
      </div>
    )
  }

  // Use just module code for short labels
  const chartData = data.map(d => {
    const parts = d.module.split(' - ')
    return {
      ...d,
      shortModule: parts.length > 1 ? parts[1] : d.module,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={520}>
      <RadarChart cx="50%" cy="48%" outerRadius="72%" data={chartData}>
        <defs>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.actual} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.actual} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="expectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.expected} stopOpacity={0.2} />
            <stop offset="100%" stopColor={c.expected} stopOpacity={0.05} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <PolarGrid
          stroke="var(--border)"
          strokeOpacity={0.25}
          gridType="circle"
        />
        <PolarAngleAxis
          dataKey="shortModule"
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
        {/* Expected (background area) */}
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
        {/* Actual (primary area with glow) */}
        <Radar
          name={actualLabel}
          dataKey="actual"
          stroke={c.actual}
          fill="url(#actualGradient)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
          filter="url(#glow)"
        />
        <Legend content={<CustomLegend />} />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}
