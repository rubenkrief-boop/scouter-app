'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Mic2, Headphones, Clock, User2 } from 'lucide-react'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { getParticipantsForAtelier, SESSION_COLORS } from '../formations-helpers'

// ============================================
// Ateliers Tab — grouped by type then by session, CLICKABLE cards
// ============================================

export function AteliersTab({
  ateliers, sessions, selectedSession, inscriptions, progMappings, onSelectAtelier,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  selectedSession: string
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  onSelectAtelier: (a: FormationAtelierWithSession) => void
}) {
  const types = ['Audio', 'Assistante'] as const
  const etatColors: Record<string, string> = {
    'Terminé': 'text-green-500',
    'En cours': 'text-yellow-500',
    'Pas commencé': 'text-muted-foreground',
  }

  const visibleSessions = selectedSession === 'all'
    ? sessions
    : sessions.filter(s => s.code === selectedSession)

  return (
    <div className="space-y-8">
      {types.map(type => {
        const typeAteliers = ateliers.filter(a => a.type === type)
        if (typeAteliers.length === 0) return null

        return (
          <div key={type}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              {type === 'Audio' ? <Mic2 className="h-4 w-4 text-cyan-500" /> : <Headphones className="h-4 w-4 text-orange-500" />}
              {type === 'Audio' ? 'Audioprothésistes' : 'Assistantes'}
            </h3>

            {visibleSessions.map(session => {
              const sessionTypeAteliers = typeAteliers.filter(a => a.session_id === session.id)
              if (sessionTypeAteliers.length === 0) return null

              return (
                <div key={session.id} className="mb-6">
                  <h4 className={`text-sm font-bold mb-3 ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || 'text-foreground'}`}>
                    {session.label}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sessionTypeAteliers.map(a => {
                      const participantCount = getParticipantsForAtelier(a, inscriptions, progMappings).length

                      return (
                        <Card
                          key={a.id}
                          className="hover:border-primary/40 transition-colors cursor-pointer"
                          onClick={() => onSelectAtelier(a)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-semibold text-sm leading-tight">{a.nom}</span>
                              <span className={`text-xs font-medium whitespace-nowrap ${etatColors[a.etat] || ''}`}>{a.etat}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {a.formateur && (
                                <span className="flex items-center gap-1">
                                  <User2 className="h-3 w-3" /> {a.formateur}
                                </span>
                              )}
                              {a.duree && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {a.duree}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[session.code] || ''}`}>
                                {session.code.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                <Users className="h-3 w-3 inline mr-1" />
                                {participantCount} part.
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {ateliers.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Aucun atelier</p>
      )}
    </div>
  )
}
