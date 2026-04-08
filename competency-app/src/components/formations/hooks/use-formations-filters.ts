'use client'

import { useState, useMemo } from 'react'
import type { FormationInscriptionWithSession } from '@/lib/types'
import { normalizeName } from '@/lib/utils'
import type { SortKey, SortDir } from '../formations-helpers'

export function useFormationsFilters(inscriptions: FormationInscriptionWithSession[]) {
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterProgramme, setFilterProgramme] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortKey>('nom')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Check if selected session uses format rotatif
  const isRotatifSession = useMemo(() => {
    if (selectedSession === 'all') return false
    const sessionInsc = inscriptions.filter(i => i.session?.code === selectedSession)
    return sessionInsc.length > 0 && sessionInsc.every(i => i.programme === 'Format rotatif')
  }, [selectedSession, inscriptions])

  // Show programme filter only for P1-P4 sessions
  const showProgrammeFilter = selectedSession !== 'all' && !isRotatifSession

  // Filtered inscriptions
  const filteredInscriptions = useMemo(() => {
    let result = inscriptions
    if (selectedSession !== 'all') {
      result = result.filter(i => i.session?.code === selectedSession)
    }
    if (filterType !== 'all') result = result.filter(i => i.type === filterType)
    if (filterProgramme !== 'all' && showProgrammeFilter) result = result.filter(i => i.programme === filterProgramme)
    if (filterStatut !== 'all') result = result.filter(i => i.statut === filterStatut)
    if (search) {
      const q = normalizeName(search)
      result = result.filter(i =>
        normalizeName(i.nom).includes(q) ||
        normalizeName(i.prenom).includes(q) ||
        (i.centre && normalizeName(i.centre).includes(q))
      )
    }
    return result
  }, [inscriptions, selectedSession, search, filterType, filterProgramme, filterStatut, showProgrammeFilter])

  // Toggle sort column
  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  return {
    selectedSession,
    setSelectedSession,
    search,
    setSearch,
    filterType,
    setFilterType,
    filterProgramme,
    setFilterProgramme,
    filterStatut,
    setFilterStatut,
    sortBy,
    sortDir,
    toggleSort,
    isRotatifSession,
    showProgrammeFilter,
    filteredInscriptions,
  }
}
