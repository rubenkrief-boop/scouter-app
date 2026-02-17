'use client'

import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from 'lucide-react'
import type { RadarDataPoint } from '@/lib/types'

interface ModuleProgressListProps {
  data: RadarDataPoint[]
}

export function ModuleProgressList({ data }: ModuleProgressListProps) {
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate mr-2">{item.module}</span>
            <div className="flex items-center gap-2">
              {item.actual >= item.expected && item.actual > 0 && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              )}
              <span className="text-muted-foreground tabular-nums">
                {Math.round(item.actual)}%
              </span>
            </div>
          </div>
          <div className="relative">
            <Progress value={item.actual} className="h-2" />
          </div>
        </div>
      ))}

      {data.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Aucune donnée
        </div>
      )}
    </div>
  )
}
