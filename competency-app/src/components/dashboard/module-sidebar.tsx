'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'
import type { RadarDataPoint } from '@/lib/types'

interface ModuleSidebarProps {
  data: RadarDataPoint[]
}

function getScoreColor(actual: number, expected: number): string {
  if (expected === 0) return 'bg-violet-500'
  const ratio = actual / expected
  if (ratio >= 1) return 'bg-emerald-500'
  if (ratio >= 0.7) return 'bg-amber-500'
  return 'bg-red-400'
}

function getScoreTextColor(actual: number, expected: number): string {
  if (expected === 0) return 'text-violet-600'
  const ratio = actual / expected
  if (ratio >= 1) return 'text-emerald-600'
  if (ratio >= 0.7) return 'text-amber-600'
  return 'text-red-500'
}

function getStatusIcon(actual: number, expected: number) {
  if (expected === 0) return null
  const ratio = actual / expected
  if (ratio >= 1) return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
  if (ratio >= 0.7) return <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
  return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
}

export function ModuleSidebar({ data }: ModuleSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Sort by gap (biggest gap first)
  const sorted = [...data].sort((a, b) => {
    const gapA = a.expected - a.actual
    const gapB = b.expected - b.actual
    return gapB - gapA
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header with collapse toggle */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Détail par module
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {data.length} modules — cliquez pour {collapsed ? 'développer' : 'réduire'}
          </p>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Module list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="py-1">
            {sorted.map((item, index) => {
              const parts = item.module.split(' - ')
              const code = parts[0]?.trim() || ''
              const name = parts[1]?.trim() || item.module
              const color = item.moduleColor || '#6366f1'
              const pct = Math.round(item.actual)
              const expectedPct = Math.round(item.expected)
              const gap = item.expected - item.actual

              return (
                <div
                  key={index}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50"
                >
                  {/* Colored dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  {/* Module name + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                        {name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {getStatusIcon(item.actual, item.expected)}
                        <span className={`text-sm font-bold tabular-nums ${getScoreTextColor(item.actual, item.expected)}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1.5">
                      {/* Expected marker */}
                      {item.expected > 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"
                          style={{ left: `${Math.min(item.expected, 100)}%` }}
                        />
                      )}
                      {/* Actual bar */}
                      <div
                        className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-500 ${getScoreColor(item.actual, item.expected)}`}
                        style={{ width: `${Math.min(item.actual, 100)}%` }}
                      />
                    </div>

                    {/* Expected vs actual label */}
                    {item.expected > 0 && (
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-gray-400">
                          Attendu : {expectedPct}%
                        </span>
                        {gap > 5 && (
                          <span className="text-[9px] text-red-400">
                            -{Math.round(gap)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {data.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Aucune donnée
            </div>
          )}
        </div>
      )}
    </div>
  )
}
