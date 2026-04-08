'use client'

import { useMemo } from 'react'
import type { FormationAtelierWithSession, FormationInscriptionWithSession, FormationSession } from '@/lib/types'
import type { ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { normalizeName } from '@/lib/utils'
import { getAteliersForParticipant, groupeAtelier } from '../formations-helpers'

export function useDoublonsData(
  inscriptions: FormationInscriptionWithSession[],
  ateliers: FormationAtelierWithSession[],
  progAtelierMappings: ProgrammeAtelierMapping[]
) {
  // Doublons: multi-session persons + atelier doublons with EQUIVALENCES/EXCLUSIONS
  return useMemo(() => {
    const byKey: Record<string, { inscriptions: FormationInscriptionWithSession[] }> = {}

    for (const i of inscriptions) {
      const k = `${normalizeName(i.prenom)}|${normalizeName(i.nom)}|${i.type}`
      if (!byKey[k]) byKey[k] = { inscriptions: [] }
      byKey[k].inscriptions.push(i)
    }

    // Only keep multi-session persons
    const multiSession = Object.values(byKey).filter(g => g.inscriptions.length > 1)

    // Detect atelier doublons using groupeAtelier equivalence system
    const doublons = multiSession.map(g => {
      const insc = g.inscriptions
      const nom = insc[0].nom
      const prenom = insc[0].prenom
      const type = insc[0].type
      const centre = insc.find(i => i.centre)?.centre || null
      const statuts = new Set(insc.map(i => i.statut))

      // Get ateliers per session
      const sessionAteliers: { session: FormationSession; programme: string; atelierNames: string[] }[] = []
      for (const i of insc) {
        const pAteliers = getAteliersForParticipant(i.session.id, i.type, i.programme, ateliers, progAtelierMappings)
        sessionAteliers.push({
          session: i.session,
          programme: i.programme,
          atelierNames: pAteliers.map(a => a.nom),
        })
      }

      // Find duplicate ateliers across sessions using groupeAtelier
      const atelierDoublons: { name: string; sessions: { code: string; label: string }[] }[] = []
      const atelierGroupMap: Record<string, { name: string; sessions: { code: string; label: string }[] }> = {}

      for (const sa of sessionAteliers) {
        for (const name of sa.atelierNames) {
          const groupKey = groupeAtelier(name, type, sa.session.code)
          if (!atelierGroupMap[groupKey]) {
            atelierGroupMap[groupKey] = { name, sessions: [] }
          }
          atelierGroupMap[groupKey].sessions.push({
            code: sa.session.code,
            label: sa.session.label,
          })
        }
      }

      for (const [, info] of Object.entries(atelierGroupMap)) {
        if (info.sessions.length > 1) {
          atelierDoublons.push(info)
        }
      }

      return {
        nom, prenom, type, centre, statuts,
        sessions: insc.map(i => ({ session: i.session, programme: i.programme, statut: i.statut })),
        count: insc.length,
        atelierDoublons,
      }
    })

    // Only keep people with actual atelier doublons for count
    const withDoublons = doublons.filter(d => d.atelierDoublons.length > 0)

    return {
      doublons,
      doublonsWithAteliers: withDoublons,
      multiSessionCount: multiSession.length,
      audioRecurrent: multiSession.filter(g => g.inscriptions[0].type === 'Audio').length,
      assistanteRecurrent: multiSession.filter(g => g.inscriptions[0].type === 'Assistante').length,
      atelierDoublonCount: withDoublons.length,
    }
  }, [inscriptions, ateliers, progAtelierMappings])
}
