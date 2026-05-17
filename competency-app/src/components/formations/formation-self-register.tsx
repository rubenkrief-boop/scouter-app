'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar, Mic2, Headphones, Eye, Check, UserPlus, UserMinus, Loader2,
} from 'lucide-react'
import type {
  FormationSession,
  FormationProgrammeSettingWithCount,
  FormationProgrammeFile,
  FormationInscriptionWithSession,
  FormationType,
} from '@/lib/types'
import { selfRegisterFormation, selfUnregisterFormation } from '@/lib/actions/formations'

interface FormationSelfRegisterProps {
  sessions: FormationSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  programmeFiles: FormationProgrammeFile[]
  myInscriptions: FormationInscriptionWithSession[]
  userStatut: 'Succursale' | 'Franchise'
  /** Filtre les programmes affiches au type metier de l'utilisateur :
   *  un audioprothesiste ne voit que les programmes Audio, une
   *  assistante que les Assistante. null = affiche les deux types. */
  userType?: 'Audio' | 'Assistante' | null
}

export function FormationSelfRegister({
  sessions,
  programmeSettings,
  programmeFiles,
  myInscriptions,
  userStatut,
  userType = null,
}: FormationSelfRegisterProps) {
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [confirmingProg, setConfirmingProg] = useState<{ sessionId: string; type: FormationType; programme: string } | null>(null)
  // Le DPC est intrinseque a un programme (un programme est ou n'est pas
  // DPC, defini cote admin). On envoie toujours false depuis l'UI et la
  // logique DPC sera deduite du programme cote serveur si besoin.
  const dpc = false
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  function handleRegister() {
    if (!confirmingProg) return
    const id = `${confirmingProg.sessionId}-${confirmingProg.type}-${confirmingProg.programme}`
    setActionId(id)
    startTransition(async () => {
      const result = await selfRegisterFormation({
        session_id: confirmingProg.sessionId,
        type: confirmingProg.type,
        programme: confirmingProg.programme,
        dpc,
      })
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', `Inscription confirmee : ${confirmingProg.programme} (${confirmingProg.type})`)
      }
      setConfirmingProg(null)
      setActionId(null)
      router.refresh()
    })
  }

  function handleUnregister(inscriptionId: string) {
    if (!confirm('Etes-vous sur de vouloir vous desinscrire ?')) return
    setActionId(inscriptionId)
    startTransition(async () => {
      const result = await selfUnregisterFormation(inscriptionId)
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', 'Desinscription effectuee')
      }
      setActionId(null)
      router.refresh()
    })
  }

  // Filter to only open sessions
  const openSessions = sessions.filter(s => s.registration_open && s.is_active)

  if (openSessions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-500" />
          Inscription aux formations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Inscrivez-vous aux programmes de formation disponibles
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-600 border border-green-500/20'
              : 'bg-red-500/10 text-red-600 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}

        {openSessions.map(session => {
          const sessionSettings = programmeSettings.filter(s => s.session_id === session.id)
          const sessionFiles = programmeFiles.filter(f => f.session_id === session.id)
          const audioFile = sessionFiles.find(f => f.type === 'Audio')
          const assistanteFile = sessionFiles.find(f => f.type === 'Assistante')
          const audioSettings = sessionSettings.filter(s => s.type === 'Audio')
          const assistanteSettings = sessionSettings.filter(s => s.type === 'Assistante')

          // Find user's existing inscriptions for this session
          const mySessionInscriptions = myInscriptions.filter(i => i.session_id === session.id)

          return (
            <div key={session.id} className="space-y-3">
              {/* Session header */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{session.label}</span>
                {session.date_info && (
                  <span className="text-xs text-muted-foreground">&mdash; {session.date_info}</span>
                )}
              </div>

              {/* Audio section : masquee si userType=Assistante */}
              {audioSettings.length > 0 && userType !== 'Assistante' && (
                <div className="space-y-2 pl-2 border-l-2 border-cyan-200">
                  <div className="flex items-center gap-2">
                    <Mic2 className="h-3.5 w-3.5 text-cyan-500" />
                    <span className="text-sm font-medium text-cyan-700">Audio</span>
                    {audioFile && (
                      <a href={audioFile.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Eye className="h-3 w-3 mr-1" /> Voir le programme
                        </Button>
                      </a>
                    )}
                  </div>
                  {renderProgrammeList(session.id, 'Audio', audioSettings, mySessionInscriptions)}
                </div>
              )}

              {/* Assistante section : masquee si userType=Audio */}
              {assistanteSettings.length > 0 && userType !== 'Audio' && (
                <div className="space-y-2 pl-2 border-l-2 border-orange-200">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">Assistante</span>
                    {assistanteFile && (
                      <a href={assistanteFile.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Eye className="h-3 w-3 mr-1" /> Voir le programme
                        </Button>
                      </a>
                    )}
                  </div>
                  {renderProgrammeList(session.id, 'Assistante', assistanteSettings, mySessionInscriptions)}
                </div>
              )}

              {audioSettings.length === 0 && assistanteSettings.length === 0 && (
                <p className="text-xs text-muted-foreground pl-6">Aucun programme configure pour cette session</p>
              )}
            </div>
          )
        })}

        {/* Confirmation dialog (inline) */}
        {confirmingProg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background rounded-xl shadow-lg p-6 max-w-sm w-full mx-4 space-y-4">
              <h3 className="font-semibold text-sm">Confirmer l&apos;inscription</h3>
              <p className="text-sm text-muted-foreground">
                Vous allez vous inscrire au programme{' '}
                <strong>{confirmingProg.programme}</strong> ({confirmingProg.type})
                pour la session{' '}
                <strong>{sessions.find(s => s.id === confirmingProg.sessionId)?.label}</strong>.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmingProg(null)}>
                  Annuler
                </Button>
                <Button size="sm" onClick={handleRegister} disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Confirmer
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  function renderProgrammeList(
    sessionId: string,
    type: FormationType,
    settings: FormationProgrammeSettingWithCount[],
    mySessionInscriptions: FormationInscriptionWithSession[],
  ) {
    // Check if user is already registered for ANY programme of this type
    const alreadyRegisteredForType = mySessionInscriptions.find(i => i.type === type)

    return (
      <div className="space-y-1.5 ml-4">
        {settings.map(s => {
          // Check if user is registered for THIS specific programme
          const myInsc = mySessionInscriptions.find(i => i.type === type && i.programme === s.programme)

          // Use capacity based on user's statut
          const maxForUser = userStatut === 'Franchise' ? s.max_franchise : s.max_succ
          const countForUser = userStatut === 'Franchise' ? s.current_count_franchise : s.current_count_succ
          const isFull = maxForUser > 0 && countForUser >= maxForUser
          const remaining = maxForUser === 0 ? null : maxForUser - countForUser
          const isLoading = actionId === `${sessionId}-${type}-${s.programme}` || actionId === myInsc?.id

          // User is registered for another programme of this type (not this one)
          const registeredElsewhere = !myInsc && !!alreadyRegisteredForType

          return (
            <div key={s.id} className={`flex items-center justify-between py-1.5 px-3 rounded-lg border border-border/30 ${
              myInsc ? 'bg-emerald-50/50' : isFull ? 'bg-red-50/30' : registeredElsewhere ? 'bg-muted/10 opacity-50' : 'bg-muted/20'
            }`}>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{s.programme}</Badge>
                {remaining !== null ? (
                  <span className={`text-xs ${isFull ? 'text-red-500 font-medium' : remaining <= 3 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {isFull ? 'Complet' : `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Places disponibles</span>
                )}
                {s.salle && (
                  <Badge variant="secondary" className="text-[10px]">
                    Salle : {s.salle}
                  </Badge>
                )}
              </div>

              <div>
                {myInsc ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                      <Check className="h-3 w-3 mr-0.5" /> Inscrit
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => handleUnregister(myInsc.id)}
                      disabled={isPending}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3 mr-0.5" />}
                      Se desinscrire
                    </Button>
                  </div>
                ) : isFull ? (
                  <Badge variant="secondary" className="text-xs text-red-500">
                    Complet
                  </Badge>
                ) : registeredElsewhere ? (
                  <span className="text-xs text-muted-foreground italic">
                    Deja inscrit a {alreadyRegisteredForType.programme}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmingProg({ sessionId, type, programme: s.programme })}
                    disabled={isPending}
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
                    S&apos;inscrire
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}
