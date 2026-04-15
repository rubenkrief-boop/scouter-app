'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { X, User2, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { updateFormationInscription } from '@/lib/actions/formations'
import { getAteliersForParticipant, SESSION_COLORS, PROG_COLORS, groupByNormalizedName, type GroupedParticipant } from '../formations-helpers'

// ============================================
// Participant Profile Modal
// ============================================

export function ParticipantModal({
  participant, allInscriptions, ateliers, progMappings, onClose, isAdmin,
}: {
  participant: GroupedParticipant
  allInscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  onClose: () => void
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  // Get ALL inscriptions for this person (unfiltered)
  const personKey = groupByNormalizedName(participant.prenom, participant.nom)
  const personInscriptions = allInscriptions.filter(i => {
    const k = groupByNormalizedName(i.prenom, i.nom)
    return k === personKey
  }).sort((a, b) => (a.session?.sort_order ?? 0) - (b.session?.sort_order ?? 0))

  const types = [...new Set(personInscriptions.map(i => i.type))]
  const statuts = [...new Set(personInscriptions.map(i => i.statut))]

  const handleUpdate = (id: string, field: string, value: string | boolean) => {
    startTransition(async () => {
      await updateFormationInscription(id, { [field]: value })
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">{participant.prenom} {participant.nom}</h2>
            <div className="flex items-center gap-2 mt-1">
              <User2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {types.map(t => t === 'Audio' ? 'Audioproth.' : 'Assistante').join(' / ')}
                {' · '}
                {statuts.join(' / ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {personInscriptions.length} session{personInscriptions.length > 1 ? 's' : ''}
            </Badge>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Formation History */}
        <div className="p-6 space-y-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Historique de formation
          </h3>

          {personInscriptions.map((insc, idx) => {
            const sessionAteliers = getAteliersForParticipant(
              insc.session.id, insc.type, insc.programme, ateliers, progMappings
            )
            const isEditing = editingId === insc.id

            return (
              <div key={idx} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={SESSION_COLORS[insc.session.code] || ''}>
                      {insc.session.label}
                    </Badge>
                    {insc.session.date_info && (
                      <span className="text-xs text-muted-foreground">{insc.session.date_info}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${PROG_COLORS[insc.programme] || ''}`}>
                      {insc.programme}
                    </Badge>
                    {isAdmin && (
                      <button
                        onClick={() => setEditingId(isEditing ? null : insc.id)}
                        className={`p-1 rounded hover:bg-muted ${isEditing ? 'text-cyan-400' : 'text-muted-foreground hover:text-foreground'}`}
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline edit controls */}
                {isEditing && (
                  <div className="ml-2 p-3 rounded-lg bg-muted/50 border border-border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Type</label>
                        <Select
                          defaultValue={insc.type}
                          onValueChange={(v) => handleUpdate(insc.id, 'type', v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Audio">Audio</SelectItem>
                            <SelectItem value="Assistante">Assistante</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Statut</label>
                        <Select
                          defaultValue={insc.statut}
                          onValueChange={(v) => handleUpdate(insc.id, 'statut', v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Succursale">Succursale</SelectItem>
                            <SelectItem value="Franchise">Franchise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Programme</label>
                        <Select
                          defaultValue={insc.programme}
                          onValueChange={(v) => handleUpdate(insc.id, 'programme', v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="P1">P1</SelectItem>
                            <SelectItem value="P2">P2</SelectItem>
                            <SelectItem value="P3">P3</SelectItem>
                            <SelectItem value="P4">P4</SelectItem>
                            <SelectItem value="Format rotatif">Format rotatif</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">DPC</label>
                        <Select
                          defaultValue={insc.dpc ? 'true' : 'false'}
                          onValueChange={(v) => handleUpdate(insc.id, 'dpc', v === 'true')}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Oui</SelectItem>
                            <SelectItem value="false">Non</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {isPending && (
                      <p className="text-xs text-cyan-400 animate-pulse">Mise à jour...</p>
                    )}
                  </div>
                )}

                <div className="ml-2 space-y-1.5">
                  {sessionAteliers.length > 0 ? (
                    sessionAteliers.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          insc.type === 'Audio' ? 'bg-cyan-500' : 'bg-orange-500'
                        }`} />
                        <span>{a.nom}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aucun atelier mappé</p>
                  )}
                </div>

                {idx < personInscriptions.length - 1 && <Separator />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
