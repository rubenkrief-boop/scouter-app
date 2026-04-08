'use client'

import { useMemo } from 'react'
import type { FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { FormationStats, ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { getAteliersForParticipant, groupByNormalizedName, type GroupedParticipant, type SortKey, type SortDir } from '../formations-helpers'

export function useFormationsStats(params: {
  filteredInscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  progAtelierMappings: ProgrammeAtelierMapping[]
  selectedSession: string
  sortBy: SortKey
  sortDir: SortDir
}) {
  const { filteredInscriptions, ateliers, progAtelierMappings, selectedSession, sortBy, sortDir } = params

  // Grouped participants (unique persons combining all sessions)
  const groupedParticipants = useMemo(() => {
    const byKey: Record<string, GroupedParticipant> = {}

    for (const i of filteredInscriptions) {
      const key = groupByNormalizedName(i.prenom, i.nom)
      if (!byKey[key]) {
        byKey[key] = {
          nom: i.nom, prenom: i.prenom, centre: i.centre, dpc: i.dpc, profile_id: i.profile_id,
          sessions: [], types: new Set<string>(), statuts: new Set<string>(), atelierCount: 0,
        }
      }
      const g = byKey[key]
      if (i.centre) g.centre = i.centre
      g.types.add(i.type)
      g.statuts.add(i.statut)
      if (i.dpc) g.dpc = true
      if (i.profile_id) g.profile_id = i.profile_id
      g.sessions.push({ session: i.session, programme: i.programme, type: i.type, statut: i.statut, inscriptionId: i.id })
    }

    // Compute atelier count per participant
    for (const g of Object.values(byKey)) {
      let count = 0
      for (const s of g.sessions) {
        const participantAteliers = getAteliersForParticipant(s.session.id, s.type, s.programme, ateliers, progAtelierMappings)
        count += participantAteliers.length
      }
      g.atelierCount = count
    }

    // Sort
    const list = Object.values(byKey)
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortBy) {
        case 'nom':
          return dir * (a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'))
        case 'prenom':
          return dir * (a.prenom.localeCompare(b.prenom, 'fr') || a.nom.localeCompare(b.nom, 'fr'))
        case 'type': {
          const ta = [...a.types].sort().join(',')
          const tb = [...b.types].sort().join(',')
          return dir * ta.localeCompare(tb)
        }
        case 'statut': {
          const sa = [...a.statuts].sort().join(',')
          const sb = [...b.statuts].sort().join(',')
          return dir * sa.localeCompare(sb)
        }
        case 'programme': {
          const pa = a.sessions[0]?.programme || ''
          const pb = b.sessions[0]?.programme || ''
          return dir * pa.localeCompare(pb)
        }
        default:
          return a.nom.localeCompare(b.nom, 'fr')
      }
    })

    return list
  }, [filteredInscriptions, ateliers, progAtelierMappings, sortBy, sortDir])

  // Filtered ateliers
  const filteredAteliers = useMemo(() => {
    if (selectedSession === 'all') return ateliers
    return ateliers.filter(a => a.session?.code === selectedSession)
  }, [ateliers, selectedSession])

  // Stats based on unique persons
  const currentStats = useMemo(() => {
    const s: FormationStats = {
      totalParticipants: groupedParticipants.length,
      audio: groupedParticipants.filter(g => g.types.has('Audio')).length,
      assistante: groupedParticipants.filter(g => g.types.has('Assistante')).length,
      succursale: groupedParticipants.filter(g => g.statuts.has('Succursale')).length,
      franchise: groupedParticipants.filter(g => g.statuts.has('Franchise')).length,
      dpc: groupedParticipants.filter(g => g.dpc).length,
      byProgramme: {},
    }
    for (const g of groupedParticipants) {
      const progs = new Set(g.sessions.map(ss => ss.programme))
      for (const p of progs) {
        s.byProgramme[p] = (s.byProgramme[p] || 0) + 1
      }
    }
    return s
  }, [groupedParticipants])

  return { groupedParticipants, filteredAteliers, currentStats }
}
