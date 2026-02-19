'use client'

import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'
import type { RadarDataPoint } from '@/lib/types'

interface ModuleProgressListProps {
  data: RadarDataPoint[]
}

function getScoreColor(actual: number, expected: number): string {
  const ratio = expected > 0 ? actual / expected : 0
  if (ratio >= 1) return 'bg-emerald-500'
  if (ratio >= 0.7) return 'bg-amber-500'
  return 'bg-red-400'
}

function getScoreTextColor(actual: number, expected: number): string {
  const ratio = expected > 0 ? actual / expected : 0
  if (ratio >= 1) return 'text-emerald-600'
  if (ratio >= 0.7) return 'text-amber-600'
  return 'text-red-500'
}

function getScoreIcon(actual: number, expected: number) {
  const ratio = expected > 0 ? actual / expected : 0
  if (ratio >= 1) return <CheckCircle className="h-4 w-4 text-emerald-500" />
  if (ratio >= 0.7) return <TrendingUp className="h-4 w-4 text-amber-500" />
  return <AlertCircle className="h-4 w-4 text-red-400" />
}

export function ModuleProgressList({ data }: ModuleProgressListProps) {
  // Sort by gap (biggest gap first = most improvement needed)
  const sorted = [...data].sort((a, b) => {
    const gapA = a.expected - a.actual
    const gapB = b.expected - b.actual
    return gapB - gapA
  })

  return (
    <div className="space-y-2.5">
      {sorted.map((item, index) => {
        const parts = item.module.split(' - ')
        const code = parts[0] || ''
        const name = parts[1] || item.module
        const gap = item.expected - item.actual

        return (
          <div
            key={index}
            className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            {/* Module code badge */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {code}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {name}
                </span>
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  {getScoreIcon(item.actual, item.expected)}
                  <span className={`text-sm font-bold tabular-nums ${getScoreTextColor(item.actual, item.expected)}`}>
                    {Math.round(item.actual)}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                {/* Expected marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"
                  style={{ left: `${Math.min(item.expected, 100)}%` }}
                />
                {/* Actual bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-500 ${getScoreColor(item.actual, item.expected)}`}
                  style={{ width: `${Math.min(item.actual, 100)}%` }}
                />
              </div>

              {/* Gap indicator */}
              {gap > 5 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {Math.round(gap)}% restant pour atteindre l&apos;attendu
                </p>
              )}
            </div>
          </div>
        )
      })}

      {data.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Aucune donnee d&apos;evaluation
        </div>
      )}
    </div>
  )
}
