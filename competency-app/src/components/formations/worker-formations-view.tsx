'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GraduationCap, Calendar, Mic2, Headphones, Clock, BookOpen, Users } from 'lucide-react'
import type { FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'

const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-100 text-orange-800 border-orange-200',
  m23: 'bg-pink-100 text-pink-800 border-pink-200',
  s23: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  m24: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  s24: 'bg-purple-100 text-purple-800 border-purple-200',
  m25: 'bg-green-100 text-green-800 border-green-200',
  s25: 'bg-amber-100 text-amber-800 border-amber-200',
  m26: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-green-100 text-green-800 border-green-200',
  P4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Format rotatif': 'bg-purple-100 text-purple-800 border-purple-200',
}

interface WorkerFormationsViewProps {
  inscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  progAtelierMappings: ProgrammeAtelierMapping[]
}

function getAteliersForParticipant(
  sessionId: string,
  type: string,
  programme: string,
  ateliers: FormationAtelierWithSession[],
  progMappings: ProgrammeAtelierMapping[]
): FormationAtelierWithSession[] {
  const isRotatif = programme === 'Format rotatif'

  if (isRotatif) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  const mappedAtelierIds = new Set(
    progMappings
      .filter(m => m.session_id === sessionId && m.type === type && m.programme === programme)
      .map(m => m.atelier_id)
  )

  if (mappedAtelierIds.size === 0) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  return ateliers.filter(a => mappedAtelierIds.has(a.id))
}

export function WorkerFormationsView({
  inscriptions,
  ateliers,
  progAtelierMappings,
}: WorkerFormationsViewProps) {

  // Sort inscriptions by session sort_order (most recent first)
  const sorted = [...inscriptions].sort(
    (a, b) => (b.session?.sort_order ?? 0) - (a.session?.sort_order ?? 0)
  )

  if (sorted.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune formation enregistrée</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Votre compte n&apos;est pas encore rattaché à des inscriptions de formation.
              Contactez votre responsable si vous pensez que c&apos;est une erreur.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalAteliers = sorted.reduce((acc, insc) => {
    return acc + getAteliersForParticipant(
      insc.session_id, insc.type, insc.programme, ateliers, progAtelierMappings
    ).length
  }, 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sorted.length}</p>
              <p className="text-xs text-muted-foreground">Session{sorted.length > 1 ? 's' : ''} de formation</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAteliers}</p>
              <p className="text-xs text-muted-foreground">Ateliers suivis</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              {sorted[0]?.type === 'Audio' ? (
                <Mic2 className="h-5 w-5 text-cyan-500" />
              ) : (
                <Headphones className="h-5 w-5 text-orange-500" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{sorted[0]?.type || '-'}</p>
              <p className="text-xs text-muted-foreground">Profil formation</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {sorted.map((insc) => {
          const sessionAteliers = getAteliersForParticipant(
            insc.session_id, insc.type, insc.programme, ateliers, progAtelierMappings
          ).sort((a, b) => a.sort_order - b.sort_order)

          return (
            <Card key={insc.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={`text-sm font-semibold ${SESSION_COLORS[insc.session?.code] || ''}`}
                    >
                      {insc.session?.label}
                    </Badge>
                    {insc.session?.date_info && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {insc.session.date_info}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        insc.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'
                      }`}
                    >
                      {insc.type === 'Audio' ? (
                        <Mic2 className="h-3 w-3 mr-1" />
                      ) : (
                        <Headphones className="h-3 w-3 mr-1" />
                      )}
                      {insc.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${PROG_COLORS[insc.programme] || ''}`}
                    >
                      {insc.programme}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        insc.statut === 'Succursale' ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'
                      }`}
                    >
                      {insc.statut}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {sessionAteliers.length > 0 && (
                <>
                  <Separator />
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {sessionAteliers.length} atelier{sessionAteliers.length > 1 ? 's' : ''} au programme
                    </p>
                    <div className="grid gap-2">
                      {sessionAteliers.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{a.nom}</p>
                              {a.formateur && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {a.formateur}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {a.duree && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Clock className="h-3 w-3 mr-0.5" />
                                {a.duree}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                a.etat === 'Terminé' ? 'text-green-500 border-green-500/30' :
                                a.etat === 'En cours' ? 'text-yellow-500 border-yellow-500/30' :
                                'text-muted-foreground'
                              }`}
                            >
                              {a.etat}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
