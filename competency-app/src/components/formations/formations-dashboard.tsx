'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Users, Mic2, Headphones, Building2, Briefcase, GraduationCap, AlertTriangle, Settings } from 'lucide-react'
import Link from 'next/link'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { FormationStats, ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { groupByNormalizedName, type GroupedParticipant } from './formations-helpers'
import { getAteliersForParticipant } from './formations-helpers'
import { useFormationsFilters } from './hooks/use-formations-filters'
import { useFormationsStats } from './hooks/use-formations-stats'
import { useDoublonsData } from './hooks/use-doublons-data'
import { StatCard } from './stat-card'
import { ParticipantModal } from './modals/participant-modal'
import { AtelierModal } from './modals/atelier-modal'
import { ProgrammeModal } from './modals/programme-modal'
import { ParticipantsTab } from './tabs/participants-tab'
import { AteliersTab } from './tabs/ateliers-tab'
import { ProgrammesTab } from './tabs/programmes-tab'
import { DoublonsTab } from './tabs/doublons-tab'

// ============================================
// Types
// ============================================

interface FormationsDashboardProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  stats: FormationStats
  progAtelierMappings: ProgrammeAtelierMapping[]
  isAdmin: boolean
}

// ============================================
// Main Dashboard
// ============================================

export function FormationsDashboard({ sessions, ateliers, inscriptions, stats, progAtelierMappings, isAdmin }: FormationsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'participants' | 'ateliers' | 'programmes' | 'doublons'>('participants')
  const [selectedParticipant, setSelectedParticipant] = useState<GroupedParticipant | null>(null)
  const [selectedAtelier, setSelectedAtelier] = useState<FormationAtelierWithSession | null>(null)
  const [selectedProgramme, setSelectedProgramme] = useState<{ session: FormationSession; type: string; programme: string } | null>(null)

  const {
    selectedSession, setSelectedSession,
    search, setSearch,
    filterType, setFilterType,
    filterProgramme, setFilterProgramme,
    filterStatut, setFilterStatut,
    sortBy, sortDir, toggleSort,
    isRotatifSession,
    showProgrammeFilter,
    filteredInscriptions,
  } = useFormationsFilters(inscriptions)

  // Suppress unused warning — kept for potential future use consistency
  void isRotatifSession
  void stats

  const { groupedParticipants, filteredAteliers, currentStats } = useFormationsStats({
    filteredInscriptions,
    ateliers,
    progAtelierMappings,
    selectedSession,
    sortBy,
    sortDir,
  })

  const doublonsData = useDoublonsData(inscriptions, ateliers, progAtelierMappings)

  // Handle atelier click -> find participant and open profile modal
  const handleAtelierParticipantClick = (prenom: string, nom: string) => {
    const nKey = groupByNormalizedName(prenom, nom)
    // Build a grouped participant from all inscriptions
    const personInsc = inscriptions.filter(i => groupByNormalizedName(i.prenom, i.nom) === nKey)
    if (personInsc.length === 0) return

    const g: GroupedParticipant = {
      nom: personInsc[0].nom,
      prenom: personInsc[0].prenom,
      centre: personInsc.find(i => i.centre)?.centre || null,
      dpc: personInsc.some(i => i.dpc),
      profile_id: personInsc.find(i => i.profile_id)?.profile_id || null,
      sessions: personInsc.map(i => ({ session: i.session, programme: i.programme, type: i.type, statut: i.statut, inscriptionId: i.id })),
      types: new Set(personInsc.map(i => i.type)),
      statuts: new Set(personInsc.map(i => i.statut)),
      atelierCount: 0,
    }
    let count = 0
    for (const s of g.sessions) {
      count += getAteliersForParticipant(s.session.id, s.type, s.programme, ateliers, progAtelierMappings).length
    }
    g.atelierCount = count

    setSelectedAtelier(null) // Close atelier modal
    setSelectedProgramme(null) // Close programme modal
    setSelectedParticipant(g) // Open profile modal
  }

  const tabs = [
    { id: 'participants' as const, label: 'Participants', icon: Users },
    { id: 'ateliers' as const, label: 'Ateliers', icon: GraduationCap },
    { id: 'programmes' as const, label: 'Programmes', icon: Briefcase },
    { id: 'doublons' as const, label: `\u26A0 Doublons ateliers`, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-4">
      {/* Session Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={selectedSession === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSelectedSession('all'); setFilterProgramme('all') }}
          className="text-xs font-semibold tracking-wider"
        >
          TOUTES
        </Button>
        {sessions.map(s => (
          <Button
            key={s.code}
            variant={selectedSession === s.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectedSession(s.code); setFilterProgramme('all') }}
            className="text-xs font-semibold tracking-wider"
          >
            {s.label}
          </Button>
        ))}
        {isAdmin && (
          <Link href="/formations/admin" className="ml-auto">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              Admin
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Participants" value={currentStats.totalParticipants} icon={Users} />
        <StatCard label="Audio" value={currentStats.audio} icon={Mic2} color="text-cyan-500" />
        <StatCard label="Assistantes" value={currentStats.assistante} icon={Headphones} color="text-orange-500" />
        <StatCard label="Succursale" value={currentStats.succursale} icon={Building2} color="text-green-500" />
        <StatCard label="Franchise" value={currentStats.franchise} icon={Briefcase} color="text-yellow-500" />
        <StatCard label="DPC" value={currentStats.dpc} icon={GraduationCap} color="text-purple-500" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'participants' && (
        <ParticipantsTab
          participants={groupedParticipants}
          selectedSession={selectedSession}
          search={search}
          onSearchChange={setSearch}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterProgramme={filterProgramme}
          onFilterProgrammeChange={setFilterProgramme}
          filterStatut={filterStatut}
          onFilterStatutChange={setFilterStatut}
          onSelectParticipant={setSelectedParticipant}
          showProgrammeFilter={showProgrammeFilter}
          sortBy={sortBy}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === 'ateliers' && (
        <AteliersTab
          ateliers={filteredAteliers}
          sessions={sessions}
          selectedSession={selectedSession}
          inscriptions={inscriptions}
          progMappings={progAtelierMappings}
          onSelectAtelier={setSelectedAtelier}
        />
      )}

      {activeTab === 'programmes' && (
        <ProgrammesTab
          sessions={sessions}
          ateliers={ateliers}
          inscriptions={filteredInscriptions}
          progMappings={progAtelierMappings}
          selectedSession={selectedSession}
          onSelectProgramme={(session, type, programme) => setSelectedProgramme({ session, type, programme })}
          onSelectAtelier={setSelectedAtelier}
        />
      )}

      {activeTab === 'doublons' && (
        <DoublonsTab data={doublonsData} onSelectPerson={handleAtelierParticipantClick} />
      )}

      {/* Profile Modal */}
      {selectedParticipant && (
        <ParticipantModal
          participant={selectedParticipant}
          allInscriptions={inscriptions}
          ateliers={ateliers}
          progMappings={progAtelierMappings}
          onClose={() => setSelectedParticipant(null)}
          isAdmin={isAdmin}
        />
      )}

      {/* Atelier Modal */}
      {selectedAtelier && (
        <AtelierModal
          atelier={selectedAtelier}
          inscriptions={inscriptions}
          progMappings={progAtelierMappings}
          onClose={() => setSelectedAtelier(null)}
          onSelectParticipant={handleAtelierParticipantClick}
        />
      )}

      {/* Programme Modal */}
      {selectedProgramme && (
        <ProgrammeModal
          session={selectedProgramme.session}
          type={selectedProgramme.type}
          programme={selectedProgramme.programme}
          inscriptions={inscriptions}
          ateliers={ateliers}
          progMappings={progAtelierMappings}
          onClose={() => setSelectedProgramme(null)}
          onSelectParticipant={handleAtelierParticipantClick}
        />
      )}
    </div>
  )
}
