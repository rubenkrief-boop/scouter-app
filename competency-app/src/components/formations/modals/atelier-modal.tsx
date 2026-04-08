'use client'

import { Badge } from '@/components/ui/badge'
import { X, Clock, User2 } from 'lucide-react'
import type { FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { getParticipantsForAtelier, SESSION_COLORS } from '../formations-helpers'

// ============================================
// Atelier Modal — shows participants for this atelier
// ============================================

export function AtelierModal({
  atelier, inscriptions, progMappings, onClose, onSelectParticipant,
}: {
  atelier: FormationAtelierWithSession
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  onClose: () => void
  onSelectParticipant: (prenom: string, nom: string) => void
}) {
  const participants = getParticipantsForAtelier(atelier, inscriptions, progMappings)

  // Deduplicate by normalized name (same person can't be in same session twice)
  const uniqueParticipants = participants.sort((a, b) =>
    a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1">
            <h2 className="text-xl font-bold">{atelier.nom}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {atelier.formateur && (
                <span className="flex items-center gap-1">
                  <User2 className="h-3.5 w-3.5" /> {atelier.formateur}
                </span>
              )}
              {atelier.duree && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {atelier.duree}
                </span>
              )}
              <Badge variant="outline" className={SESSION_COLORS[atelier.session?.code] || ''}>
                {atelier.session?.label}
              </Badge>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Participants */}
        <div className="p-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {uniqueParticipants.length} participant{uniqueParticipants.length > 1 ? 's' : ''}
          </h3>

          <div className="flex flex-wrap gap-2">
            {uniqueParticipants.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onSelectParticipant(p.prenom, p.nom)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer hover:opacity-80 ${
                  p.type === 'Audio'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'
                    : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                }`}
              >
                {p.prenom} {p.nom}
              </button>
            ))}
          </div>

          {uniqueParticipants.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun participant pour cet atelier</p>
          )}
        </div>
      </div>
    </div>
  )
}
