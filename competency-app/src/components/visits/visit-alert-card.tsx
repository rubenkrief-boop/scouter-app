'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { OverdueCenter } from '@/lib/actions/visits'

interface VisitAlertCardProps {
  overdueCenters: OverdueCenter[]
}

export function VisitAlertCard({ overdueCenters }: VisitAlertCardProps) {
  if (overdueCenters.length === 0) return null

  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          Centres en retard de visite
          <Badge variant="destructive" className="ml-1 text-xs">
            {overdueCenters.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {overdueCenters.slice(0, 5).map(c => (
            <div key={c.location_id} className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-gray-900/50 rounded-md border border-orange-100 dark:border-orange-900/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.zone_color || '#F59E0B' }} />
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{c.location_name}</span>
                <Badge variant="outline" className="text-[10px]" style={{ borderColor: c.zone_color || undefined, color: c.zone_color || undefined }}>
                  {c.zone_name}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {c.last_visit_date
                    ? `Derniere : ${new Date(c.last_visit_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                    : 'Jamais visitee'
                  }
                </span>
                <Badge variant="destructive" className="text-xs">
                  {c.days_since_last > 900 ? 'Jamais' : `+${c.days_since_last - c.target_days}j`}
                </Badge>
              </div>
            </div>
          ))}
          {overdueCenters.length > 5 && (
            <Link
              href="/visits"
              className="block text-center text-sm text-orange-600 hover:text-orange-700 font-medium mt-2"
            >
              Voir les {overdueCenters.length - 5} autres centres →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
