'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Mic2, Headphones, Clock, BookOpen, Users } from 'lucide-react'
import type {
  FormationSession,
  FormationProgrammeSettingWithCount,
  FormationAtelierWithSession,
} from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'

interface Props {
  sessions: FormationSession[]                              // sessions avec inscriptions ouvertes
  programmeSettings: FormationProgrammeSettingWithCount[]
  ateliers: FormationAtelierWithSession[]
  progAtelierMappings: ProgrammeAtelierMapping[]
}

/**
 * Affichage en mode preview des sessions a venir : tous les programmes
 * (Audio + Assistante) avec leurs ateliers, salles, capacites. Permet au
 * gerant/manager de visualiser le contenu avant de choisir une inscription.
 */
export function UpcomingSessionPreview({ sessions, programmeSettings, ateliers, progAtelierMappings }: Props) {
  if (sessions.length === 0) return null

  return (
    <div className="space-y-4">
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
  // Regroupe par type
  const audioSettings = useMemo(
    () => settings.filter((s) => s.type === 'Audio').sort((a, b) => a.programme.localeCompare(b.programme)),
    [settings],
  )
  const assistSettings = useMemo(
    () => settings.filter((s) => s.type === 'Assistante').sort((a, b) => a.programme.localeCompare(b.programme)),
    [settings],
  )

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span>{session.label}</span>
            {session.date_info && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {session.date_info}
              </span>
            )}
          </div>
          <Badge variant="default" className="bg-green-600">Inscriptions ouvertes</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Programmes proposés cette session — détail du contenu pour faire ton choix avant inscription.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio */}
        {audioSettings.length > 0 && (
          <ProgrammesByType
            type="Audio"
            settings={audioSettings}
            ateliers={ateliers}
            mappings={mappings}
          />
        )}
        {/* Assistante */}
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
  const Icon = type === 'Audio' ? Mic2 : Headphones
  const colorClass = type === 'Audio' ? 'text-cyan-600' : 'text-orange-600'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <h3 className="text-sm font-semibold">{type}</h3>
        <Badge variant="outline" className="text-[10px]">
          {settings.length} programme{settings.length > 1 ? 's' : ''}
        </Badge>
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
            <Card key={setting.id} className="border bg-card hover:shadow-md transition-shadow">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={type === 'Audio' ? 'bg-cyan-600' : 'bg-orange-600'}>
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
                  <div className="text-[10px] text-muted-foreground">
                    Capacité : {setting.max_succ ?? '∞'} succ · {setting.max_franchise ?? '∞'} fr.
                  </div>
                )}
                {progAteliers.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic">
                    Aucun atelier mappé
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {progAteliers.map((a) => (
                      <li key={a.id} className="flex items-start gap-1">
                        <BookOpen className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium leading-tight truncate" title={a.nom}>
                            {a.nom}
                          </p>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
                            {a.formateur && (
                              <span className="flex items-center gap-0.5">
                                <Users className="h-2.5 w-2.5" />
                                {a.formateur}
                              </span>
                            )}
                            {a.duree && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {a.duree}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
