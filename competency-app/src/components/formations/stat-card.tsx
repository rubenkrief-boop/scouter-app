'use client'

import { Card, CardContent } from '@/components/ui/card'

// ============================================
// Stat Card
// ============================================

export function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
          </div>
          <Icon className={`h-5 w-5 ${color || 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  )
}
