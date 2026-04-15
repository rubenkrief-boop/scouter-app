'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic2, Headphones, Clock, User2 } from 'lucide-react'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { getAteliersForParticipant, SESSION_COLORS, PROG_COLORS } from '../formations-helpers'

// ============================================
// Programmes Tab — by type, then by session, with ateliers + participant count
// ============================================

export function ProgrammesTab({
  sessions, ateliers, inscriptions, progMappings, selectedSession, onSelectProgramme, onSelectAtelier,
}: {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  selectedSession: string
  onSelectProgramme: (session: FormationSession, type: string, programme: string) => void
  onSelectAtelier: (a: FormationAtelierWithSession) => void
}) {
  const types = ['Audio', 'Assistante'] as const
  const visibleSessions = selectedSession === 'all'
    ? sessions
    : sessions.filter(s => s.code === selectedSession)

  return (
    <div className="space-y-8">
      {types.map(type => {
        const typeInscriptions = inscriptions.filter(i => i.type === type)
        if (typeInscriptions.length === 0) return null

        return (
          <div key={type}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              {type === 'Audio' ? <Mic2 className="h-4 w-4 text-cyan-500" /> : <Headphones className="h-4 w-4 text-orange-500" />}
              {type === 'Audio' ? 'Audioprothésistes' : 'Assistantes'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSessions.map(session => {
                const sessionInscriptions = typeInscriptions.filter(i => i.session?.id === session.id)

                // Get programmes from inscriptions AND from progMappings (for sessions without participants yet)
                const progFromInscriptions = sessionInscriptions.map(i => i.programme)
                const progFromMappings = progMappings
                  .filter(m => m.session_id === session.id && m.type === type)
                  .map(m => m.programme)
                const programmes = [...new Set([...progFromInscriptions, ...progFromMappings])]

                if (programmes.length === 0) return null

                const isRotatif = programmes.length === 1 && programmes[0] === 'Format rotatif'

                const sessionAteliers = ateliers.filter(a => a.session_id === session.id && a.type === type)
                const participantCount = sessionInscriptions.length

                if (isRotatif) {
                  return (
                    <div key={session.id} className="space-y-2">
                      <h4
                        className={`text-sm font-bold cursor-pointer hover:underline ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || ''}`}
                        onClick={() => onSelectProgramme(session, type, 'Format rotatif')}
                      >
                        {session.label}
                        <span className="text-xs font-normal text-muted-foreground ml-2">({participantCount} part.)</span>
                      </h4>
                      <p className="text-[10px] text-muted-foreground italic">
                        FORMAT ROTATIF &mdash; tous les participants {type === 'Audio' ? 'audioprothésistes' : 'assistantes'} font tous les ateliers
                      </p>
                      <div className="space-y-1.5">
                        {sessionAteliers.map(a => (
                          <Card
                            key={a.id}
                            className="bg-card cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => onSelectAtelier(a)}
                          >
                            <CardContent className="p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{a.nom}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {a.formateur && <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {a.formateur}</span>}
                                  {a.duree && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.duree}</span>}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{participantCount} part.</span>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                }

                // P1, P2, P3, P4 programmes
                return (
                  <div key={session.id} className="space-y-3">
                    <h4 className={`text-sm font-bold ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || ''}`}>
                      {session.label}
                    </h4>
                    {programmes.sort().map(prog => {
                      const progParticipants = sessionInscriptions.filter(i => i.programme === prog)
                      const progAteliers = getAteliersForParticipant(session.id, type, prog, ateliers, progMappings)

                      return (
                        <Card
                          key={prog}
                          className={`border-l-4 cursor-pointer hover:border-primary/40 transition-colors ${
                            prog === 'P1' ? 'border-l-cyan-500' :
                            prog === 'P2' ? 'border-l-orange-500' :
                            prog === 'P3' ? 'border-l-green-500' :
                            prog === 'P4' ? 'border-l-yellow-500' : 'border-l-purple-500'
                          }`}
                          onClick={() => onSelectProgramme(session, type, prog)}
                        >
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`font-bold ${PROG_COLORS[prog] || ''}`}>
                                {prog}
                              </Badge>
                              <span className="text-lg font-bold text-muted-foreground/40">{progParticipants.length}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{progParticipants.length} participants</p>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-1">
                            {progAteliers.map(a => (
                              <div key={a.id} className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  type === 'Audio' ? 'bg-cyan-500' : 'bg-orange-500'
                                }`} />
                                <span>{a.nom}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
