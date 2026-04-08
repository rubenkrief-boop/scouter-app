'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { X } from 'lucide-react'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { getAteliersForParticipant, SESSION_COLORS, PROG_COLORS } from '../formations-helpers'

// ============================================
// Programme Modal — shows participants in a programme
// ============================================

export function ProgrammeModal({
  session, type, programme, inscriptions, ateliers, progMappings, onClose, onSelectParticipant,
}: {
  session: FormationSession
  type: string
  programme: string
  inscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  onClose: () => void
  onSelectParticipant: (prenom: string, nom: string) => void
}) {
  // Get participants for this session + type + programme
  const participants = inscriptions
    .filter(i => i.session_id === session.id && i.type === type && i.programme === programme)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'))

  // Get ateliers for this programme
  const progAteliers = getAteliersForParticipant(session.id, type, programme, ateliers, progMappings)

  const isRotatif = programme === 'Format rotatif'
  const typeLabel = type === 'Audio' ? 'Audioprothésistes' : 'Assistantes'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`font-bold ${PROG_COLORS[programme] || ''}`}>
                {programme}
              </Badge>
              <Badge variant="outline" className={SESSION_COLORS[session.code] || ''}>
                {session.label}
              </Badge>
            </div>
            <h2 className="text-lg font-bold mt-2">
              {isRotatif ? `Format rotatif — ${typeLabel}` : `Programme ${programme} — ${typeLabel}`}
            </h2>
            {session.date_info && (
              <p className="text-sm text-muted-foreground mt-1">{session.date_info}</p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Ateliers section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {progAteliers.length} atelier{progAteliers.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-1.5">
              {progAteliers.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    type === 'Audio' ? 'bg-cyan-500' : 'bg-orange-500'
                  }`} />
                  <span className="font-medium">{a.nom}</span>
                  {a.formateur && (
                    <span className="text-xs text-muted-foreground">— {a.formateur}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Participants section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {participants.length} participant{participants.length > 1 ? 's' : ''}
            </h3>
            <div className="flex flex-wrap gap-2">
              {participants.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectParticipant(p.prenom, p.nom)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer hover:opacity-80 ${
                    type === 'Audio'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                  }`}
                >
                  {p.prenom} {p.nom}
                </button>
              ))}
            </div>

            {participants.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucun participant dans ce programme</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
