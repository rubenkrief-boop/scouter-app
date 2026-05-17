'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Calendar, MapPin, Mic2, Headphones, Clock, BookOpen, Users, Sparkles } from 'lucide-react'
import type {
  FormationSession,
  FormationProgrammeSettingWithCount,
  FormationAtelierWithSession,
} from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'

// Memes constantes que WorkerFormationsView pour rester coherent visuellement.
const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-100 text-orange-800 border-orange-200',
  m23: 'bg-pink-100 text-pink-800 border-pink-200',
  s23: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  m24: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  s24: 'bg-purple-100 text-purple-800 border-purple-200',
  m25: 'bg-green-100 text-green-800 border-green-200',
  s25: 'bg-amber-100 text-amber-800 border-amber-200',
  m26: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  s26: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
}

const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-green-100 text-green-800 border-green-200',
  P4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Format rotatif': 'bg-purple-100 text-purple-800 border-purple-200',
}

interface Props {
  sessions: FormationSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  ateliers: FormationAtelierWithSession[]
  progAtelierMappings: ProgrammeAtelierMapping[]
}

/**
 * Apercu des sessions a venir : programmes + ateliers visibles avant
 * choix. Aligne sur la charte graphique de WorkerFormationsView et de
 * l'admin Formations Plenieres : badges outline a teinte (Audio cyan,
 * Assistante orange), session/programme colors specifiques.
 */
export function UpcomingSessionPreview({ sessions, programmeSettings, ateliers, progAtelierMappings }: Props) {
  if (sessions.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" />
        Prochaine{sessions.length > 1 ? 's' : ''} session{sessions.length > 1 ? 's' : ''} ouverte{sessions.length > 1 ? 's' : ''}
      </div>
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          settings={programmeSettings.filter((s) => s.session_id === session.id)}
          ateliers={ateliers.filter((a) => a.session_id === session.id)}
          mappings={progAtelierMappings.filter((m) => m.session_id === session.id)}
        />
      ))}
    </div>
  )
}

function SessionCard({
  session,
  settings,
  ateliers,
  mappings,
}: {
  session: FormationSession
  settings: FormationProgrammeSettingWithCount[]
  ateliers: FormationAtelierWithSession[]
  mappings: ProgrammeAtelierMapping[]
}) {
  const audioSettings = useMemo(
    () => settings.filter((s) => s.type === 'Audio').sort((a, b) => a.programme.localeCompare(b.programme)),
    [settings],
  )
  const assistSettings = useMemo(
    () => settings.filter((s) => s.type === 'Assistante').sort((a, b) => a.programme.localeCompare(b.programme)),
    [settings],
  )

  return (
    <Card className="border-2 border-primary shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className={`text-sm font-semibold ${SESSION_COLORS[session.code] || ''}`}
            >
              {session.label}
            </Badge>
            {session.date_info && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                <Calendar className="h-3 w-3" />
                {session.date_info}
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">
            Inscriptions ouvertes
          </Badge>
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-6">
        {audioSettings.length > 0 && (
          <ProgrammesByType
            type="Audio"
            settings={audioSettings}
            ateliers={ateliers}
            mappings={mappings}
          />
        )}
        {assistSettings.length > 0 && (
          <ProgrammesByType
            type="Assistante"
            settings={assistSettings}
            ateliers={ateliers}
            mappings={mappings}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ProgrammesByType({
  type,
  settings,
  ateliers,
  mappings,
}: {
  type: 'Audio' | 'Assistante'
  settings: FormationProgrammeSettingWithCount[]
  ateliers: FormationAtelierWithSession[]
  mappings: ProgrammeAtelierMapping[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className={`text-xs ${
            type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'
          }`}
        >
          {type === 'Audio' ? (
            <Mic2 className="h-3 w-3 mr-1" />
          ) : (
            <Headphones className="h-3 w-3 mr-1" />
          )}
          {type}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {settings.length} programme{settings.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {settings.map((setting) => {
          const atelierIds = new Set(
            mappings
              .filter((m) => m.type === type && m.programme === setting.programme)
              .map((m) => m.atelier_id),
          )
          const progAteliers = ateliers
            .filter((a) => atelierIds.has(a.id))
            .sort((a, b) => a.sort_order - b.sort_order)

          return (
            <Card key={setting.id} className="border bg-card hover:shadow-sm transition-shadow">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${PROG_COLORS[setting.programme] || ''}`}
                  >
                    {setting.programme}
                  </Badge>
                  {setting.salle && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {setting.salle}
                    </span>
                  )}
                </div>
                {(setting.max_succ || setting.max_franchise) && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
                      {setting.max_succ ?? '∞'} succ.
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                      {setting.max_franchise ?? '∞'} fr.
                    </Badge>
                  </div>
                )}
                {progAteliers.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    Aucun atelier
                  </p>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    {progAteliers.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/50"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-tight truncate" title={a.nom}>
                            {a.nom}
                          </p>
                          {a.formateur && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {a.formateur}
                            </p>
                          )}
                          {a.duree && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {a.duree}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
