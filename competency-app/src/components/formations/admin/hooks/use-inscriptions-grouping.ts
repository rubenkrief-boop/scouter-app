'use client'

import type { FormationInscriptionWithSession } from '@/lib/types'
import { normalizeName } from '@/lib/utils'

export interface GroupedAdminParticipant {
  nom: string
  prenom: string
  centre: string | null
  profile_id: string | null
  types: Set<string>
  statuts: Set<string>
  dpc: boolean
  inscriptions: FormationInscriptionWithSession[]
}

/**
 * Groups inscriptions by normalized (prenom|nom) key and returns a
 * sorted array of [key, GroupedAdminParticipant] tuples.
 */
export function useInscriptionsGrouping(
  inscriptions: FormationInscriptionWithSession[]
): [string, GroupedAdminParticipant][] {
  const byKey: Record<string, GroupedAdminParticipant> = {}
  for (const i of inscriptions) {
    const key = `${normalizeName(i.prenom)}|${normalizeName(i.nom)}`
    if (!byKey[key]) {
      byKey[key] = {
        nom: i.nom, prenom: i.prenom, centre: i.centre, profile_id: i.profile_id,
        types: new Set(), statuts: new Set(), dpc: false, inscriptions: [],
      }
    }
    const g = byKey[key]
    if (i.centre) g.centre = i.centre
    g.types.add(i.type)
    g.statuts.add(i.statut)
    if (i.dpc) g.dpc = true
    if (i.profile_id) g.profile_id = i.profile_id
    g.inscriptions.push(i)
  }
  return Object.entries(byKey).sort(([, a], [, b]) =>
    a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
  )
}
