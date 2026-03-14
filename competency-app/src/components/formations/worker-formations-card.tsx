'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Calendar, Mic2, Headphones } from 'lucide-react'
import type { FormationInscriptionWithSession } from '@/lib/types'

const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
  m23: 'bg-pink-400/10 text-pink-300 border-pink-400/20',
  s23: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  m24: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20',
  s24: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
  m25: 'bg-green-400/10 text-green-300 border-green-400/20',
  s25: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  m26: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
}

const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
  P2: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
  P3: 'bg-green-400/10 text-green-300 border-green-400/20',
  P4: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20',
  'Format rotatif': 'bg-purple-400/10 text-purple-300 border-purple-400/20',
}

interface WorkerFormationsCardProps {
  formations: FormationInscriptionWithSession[]
}

export function WorkerFormationsCard({ formations }: WorkerFormationsCardProps) {
  if (formations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-500" />
            Formations plénières
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune participation aux formations plénières enregistrée.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Sort by session sort_order (most recent first)
  const sorted = [...formations].sort(
    (a, b) => (b.session?.sort_order ?? 0) - (a.session?.sort_order ?? 0)
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-purple-500" />
            Formations plénières
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {formations.length} session{formations.length > 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
          >
            {/* Session badge */}
            <Badge
              variant="outline"
              className={`text-xs font-semibold shrink-0 ${SESSION_COLORS[f.session?.code] || ''}`}
            >
              {f.session?.label || 'Session'}
            </Badge>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {f.session?.date_info && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {f.session.date_info}
                </p>
              )}
            </div>

            {/* Type + programme */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  f.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'
                }`}
              >
                {f.type === 'Audio' ? (
                  <Mic2 className="h-3 w-3 mr-0.5" />
                ) : (
                  <Headphones className="h-3 w-3 mr-0.5" />
                )}
                {f.type}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] ${PROG_COLORS[f.programme] || ''}`}
              >
                {f.programme}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
