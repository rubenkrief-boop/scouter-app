'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { RadarDataPoint } from '@/lib/types'

// eLamp-inspired: violet primary, gray secondary
const DEFAULT_COLORS = {
  actual: '#7c3aed',
  expected: '#9ca3af',
}

// ---------- Cardinal spline (courbe lisse fermée) ----------
// Génère un path SVG lisse qui passe par tous les points du radar
function cardinalSplinePath(points: { x: number; y: number }[], tension = 0.35): string {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
  }

  const n = points.length
  // Wrap-around : [dernier, ...tous, premier, deuxième] pour fermer la courbe
  const pts = [points[n - 1], ...points, points[0], points[1]]
  const t = 1 - tension

  // Commence au premier point (pts[1] = points[0])
  let d = `M${points[0].x},${points[0].y}`

  // Chaque itération trace un segment de pts[i+1] → pts[i+2]
  for (let i = 0; i < n; i++) {
    const p0 = pts[i]       // point précédent (pour la tangente)
    const p1 = pts[i + 1]   // point de départ du segment
    const p2 = pts[i + 2]   // point d'arrivée du segment
    const p3 = pts[i + 3]   // point suivant (pour la tangente)

    const cp1x = p1.x + (p2.x - p0.x) * t / 6
    const cp1y = p1.y + (p2.y - p0.y) * t / 6
    const cp2x = p2.x - (p3.x - p1.x) * t / 6
    const cp2y = p2.y - (p3.y - p1.y) * t / 6

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }

  return d
}

// Shape custom pour le Radar "actual" (rempli + stroke épais + dots)
function SmoothRadarActual(props: any) {
  const { points, stroke, strokeWidth, fill } = props
  if (!points || points.length === 0) return null

  const d = cardinalSplinePath(points)

  return (
    <g>
      <path d={d} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      {points.map((p: any, i: number) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={stroke} stroke="#fff" strokeWidth={2} />
      ))}
    </g>
  )
}

// Shape custom pour le Radar "expected" (rempli + stroke dashed, pas de dots)
function SmoothRadarExpected(props: any) {
  const { points, stroke, strokeWidth, fill } = props
  if (!points || points.length === 0) return null

  const d = cardinalSplinePath(points)

  return (
    <g>
      <path d={d} fill={fill} stroke="none" />
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray="6 3" />
    </g>
  )
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
    <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl min-w-[220px] border border-gray-700">
      <p className="font-bold text-sm mb-2 border-b border-gray-700 pb-2">{label}</p>
      {payload.map((entry: any, index: number) => {
        const isActual = entry.dataKey === 'actual'
        return (
          <div key={index} className="flex items-center gap-2.5 text-sm py-1">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
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

// Colored label tick around the radar — eLamp style with module color pills
function CustomAngleAxisTick({ x, y, payload, cx, cy }: any) {
  const item = payload.value as string
  // We encode color in the label as "COLOR|LABEL"
  const pipeIdx = item.indexOf('|')
  const color = pipeIdx > -1 ? item.substring(0, pipeIdx) : '#6366f1'
  const label = pipeIdx > -1 ? item.substring(pipeIdx + 1) : item

  const dx = x - cx
  const dy = y - cy
  const angle = Math.atan2(dy, dx)
  const dist = 30

  let textAnchor: 'start' | 'middle' | 'end' = 'middle'
  const xOff = Math.cos(angle) * dist
  let yOff = Math.sin(angle) * dist

  if (Math.cos(angle) > 0.25) {
    textAnchor = 'start'
  } else if (Math.cos(angle) < -0.25) {
    textAnchor = 'end'
  }

  if (Math.sin(angle) < -0.5) yOff -= 8
  else if (Math.sin(angle) > 0.5) yOff += 8

  return (
    <g>
      <text
        x={x + xOff}
        y={y + yOff}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill={color}
        fontSize={11}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
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

  // Encode color into label for the custom tick: "COLOR|Name"
  const chartData = data.map(d => {
    const parts = d.module.split(' - ')
    const name = parts[1]?.trim() || parts[0]?.trim() || d.module
    const color = d.moduleColor || '#6366f1'
    return { ...d, label: `${color}|${name}` }
  })

  const count = chartData.length
  // Full size: massive chart filling the space
  const chartHeight = fullSize ? 920 : (count > 15 ? 620 : 580)
  const outerRadius = fullSize
    ? (count > 15 ? '78%' : '82%')
    : (count > 15 ? '68%' : '74%')

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={chartData}>
          <defs>
            <radialGradient id="actualGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c.actual} stopOpacity={0.4} />
              <stop offset="100%" stopColor={c.actual} stopOpacity={0.1} />
            </radialGradient>
            <radialGradient id="expectedGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c.expected} stopOpacity={0.15} />
              <stop offset="100%" stopColor={c.expected} stopOpacity={0.05} />
            </radialGradient>
          </defs>
          {/* Circular grid — clean eLamp style */}
          <PolarGrid
            stroke="#e5e7eb"
            strokeOpacity={0.8}
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
          {/* Expected (background — thin dashed gray, courbe lisse) */}
          <Radar
            name={expectedLabel}
            dataKey="expected"
            stroke={c.expected}
            fill="url(#expectedGradient)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: c.expected, stroke: '#fff', strokeWidth: 2 }}
            shape={<SmoothRadarExpected />}
          />
          {/* Actual (primary — bold violet, courbe lisse avec dots) */}
          <Radar
            name={actualLabel}
            dataKey="actual"
            stroke={c.actual}
            fill="url(#actualGradient)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: c.actual, stroke: '#fff', strokeWidth: 2 }}
            shape={<SmoothRadarActual />}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
      {/* Legend inline below */}
      <div className="flex justify-center gap-8 -mt-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-0.5 rounded-full" style={{ backgroundColor: c.actual }} />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{actualLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-0.5 rounded-full border-t-2 border-dashed" style={{ borderColor: c.expected }} />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{expectedLabel}</span>
        </div>
      </div>
    </div>
  )
}
