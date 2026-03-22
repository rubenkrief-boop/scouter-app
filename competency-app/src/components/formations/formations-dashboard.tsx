'use client'

import { useState, useMemo, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Users, Mic2, Headphones, Building2, Briefcase, GraduationCap, Search, AlertTriangle, Settings, X, Clock, User2, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { FormationStats, ProgrammeAtelierMapping } from '@/lib/actions/formations'
import { deleteFormationInscription, updateFormationInscription } from '@/lib/actions/formations'
import { normalizeName } from '@/lib/utils'

// ============================================
// Color mappings
// ============================================

const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-100 text-orange-800 border-orange-200',
  m23: 'bg-pink-100 text-pink-800 border-pink-200',
  s23: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  m24: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  s24: 'bg-purple-100 text-purple-800 border-purple-200',
  m25: 'bg-green-100 text-green-800 border-green-200',
  s25: 'bg-amber-100 text-amber-800 border-amber-200',
  m26: 'bg-cyan-100 text-cyan-800 border-cyan-200',
}

const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  P2: 'bg-orange-100 text-orange-800 border-orange-200',
  P3: 'bg-green-100 text-green-800 border-green-200',
  P4: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Format rotatif': 'bg-purple-100 text-purple-800 border-purple-200',
}

// ============================================
// Doublons: Exclusions & Equivalences (from HTML prototype)
// ============================================

// Ateliers NEVER considered doublons (content differs per session)
const EXCLUSIONS = ['back office', 'best practices']

// Ateliers semantically equivalent across sessions
const EQUIVALENCES: { keywords: string[]; type: 'Audio' | 'Assistante' | 'both' }[] = [
  { keywords: ['secours'],       type: 'both' },
  { keywords: ['autophonation'], type: 'Audio' },
  { keywords: ['réglementat'],   type: 'both' },
  { keywords: ['manager 2'],     type: 'Audio' },
  { keywords: ['manager 2'],     type: 'Assistante' },
  { keywords: ['wizville'],      type: 'both' },
  { keywords: ['oney'],          type: 'both' },
  { keywords: ['renouvellement'], type: 'Audio' },
]

// ============================================
// Types
// ============================================

interface GroupedParticipant {
  nom: string
  prenom: string
  centre: string | null
  dpc: boolean
  profile_id: string | null
  sessions: { session: FormationSession; programme: string; type: string; statut: string; inscriptionId: string }[]
  types: Set<string>
  statuts: Set<string>
  atelierCount: number
}

interface FormationsDashboardProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  stats: FormationStats
  progAtelierMappings: ProgrammeAtelierMapping[]
  isAdmin: boolean
}

type SortKey = 'nom' | 'prenom' | 'type' | 'statut' | 'programme'
type SortDir = 'asc' | 'desc'

// ============================================
// Helper: get ateliers for a participant in a session
// ============================================

function getAteliersForParticipant(
  sessionId: string,
  type: string,
  programme: string,
  ateliers: FormationAtelierWithSession[],
  progMappings: ProgrammeAtelierMapping[]
): FormationAtelierWithSession[] {
  const isRotatif = programme === 'Format rotatif'

  if (isRotatif) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  const mappedAtelierIds = new Set(
    progMappings
      .filter(m => m.session_id === sessionId && m.type === type && m.programme === programme)
      .map(m => m.atelier_id)
  )

  if (mappedAtelierIds.size === 0) {
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  return ateliers.filter(a => mappedAtelierIds.has(a.id))
}

// ============================================
// Helper: get participants for an atelier
// ============================================

function getParticipantsForAtelier(
  atelier: FormationAtelierWithSession,
  inscriptions: FormationInscriptionWithSession[],
  progMappings: ProgrammeAtelierMapping[]
): FormationInscriptionWithSession[] {
  const sessionInscriptions = inscriptions.filter(
    i => i.session_id === atelier.session_id && i.type === atelier.type
  )

  if (atelier.programmes === 'Format rotatif' || !atelier.programmes) {
    return sessionInscriptions
  }

  // Find which programmes include this atelier
  const atelierMappings = progMappings.filter(
    m => m.atelier_id === atelier.id && m.session_id === atelier.session_id && m.type === atelier.type
  )
  const mappedProgrammes = new Set(atelierMappings.map(m => m.programme))

  if (mappedProgrammes.size === 0) {
    return sessionInscriptions
  }

  return sessionInscriptions.filter(i => mappedProgrammes.has(i.programme))
}

// ============================================
// Helper: Doublon atelier grouping (matching HTML logic)
// ============================================

function groupeAtelier(nomAtelier: string, type: string, sid: string): string {
  const n = normalizeName(nomAtelier)

  // Exclusions: unique key per session (never matches cross-session)
  for (const excl of EXCLUSIONS) {
    if (n.includes(excl)) {
      return `${n}_exclu|${type}_${sid}_${nomAtelier}`
    }
  }

  // Equivalences: group by keyword
  for (const eq of EQUIVALENCES) {
    if (eq.type === 'both' || eq.type === type) {
      if (eq.keywords.every(kw => n.includes(normalizeName(kw)))) {
        return `equiv|${eq.keywords.join('_')}|${eq.type === 'both' ? type : eq.type}`
      }
    }
  }

  // Default: normalized name + type
  return `${n}|${type}`
}

// ============================================
// Main Dashboard
// ============================================

export function FormationsDashboard({ sessions, ateliers, inscriptions, stats, progAtelierMappings, isAdmin }: FormationsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'participants' | 'ateliers' | 'programmes' | 'doublons'>('participants')
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterProgramme, setFilterProgramme] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')
  const [selectedParticipant, setSelectedParticipant] = useState<GroupedParticipant | null>(null)
  const [selectedAtelier, setSelectedAtelier] = useState<FormationAtelierWithSession | null>(null)
  const [selectedProgramme, setSelectedProgramme] = useState<{ session: FormationSession; type: string; programme: string } | null>(null)
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
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.nom.toLowerCase().includes(q) ||
        i.prenom.toLowerCase().includes(q) ||
        (i.centre && i.centre.toLowerCase().includes(q))
      )
    }
    return result
  }, [inscriptions, selectedSession, search, filterType, filterProgramme, filterStatut, showProgrammeFilter])

  // Grouped participants (unique persons combining all sessions)
  const groupedParticipants = useMemo(() => {
    const byKey: Record<string, GroupedParticipant> = {}

    for (const i of filteredInscriptions) {
      const key = `${normalizeName(i.prenom)}|${normalizeName(i.nom)}`
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

  // Doublons: multi-session persons + atelier doublons with EQUIVALENCES/EXCLUSIONS
  const doublonsData = useMemo(() => {
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

  // Toggle sort column
  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }

  // Handle atelier click -> find participant and open profile modal
  const handleAtelierParticipantClick = (prenom: string, nom: string) => {
    const nKey = `${normalizeName(prenom)}|${normalizeName(nom)}`
    // Build a grouped participant from all inscriptions
    const personInsc = inscriptions.filter(i => `${normalizeName(i.prenom)}|${normalizeName(i.nom)}` === nKey)
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
          sessions={sessions}
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

// ============================================
// Stat Card
// ============================================

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
          </div>
          <Icon className={`h-5 w-5 ${color || 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Participant Profile Modal
// ============================================

function ParticipantModal({
  participant, allInscriptions, ateliers, sessions, progMappings, onClose, isAdmin,
}: {
  participant: GroupedParticipant
  allInscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  progMappings: ProgrammeAtelierMapping[]
  onClose: () => void
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  // Get ALL inscriptions for this person (unfiltered)
  const personKey = `${normalizeName(participant.prenom)}|${normalizeName(participant.nom)}`
  const personInscriptions = allInscriptions.filter(i => {
    const k = `${normalizeName(i.prenom)}|${normalizeName(i.nom)}`
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
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
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

// ============================================
// Atelier Modal — shows participants for this atelier
// ============================================

function AtelierModal({
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4">
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

// ============================================
// Programme Modal — shows participants in a programme
// ============================================

function ProgrammeModal({
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-4">
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

// ============================================
// Participants Tab
// ============================================

function ParticipantsTab({
  participants, selectedSession, search, onSearchChange,
  filterType, onFilterTypeChange, filterProgramme, onFilterProgrammeChange,
  filterStatut, onFilterStatutChange, onSelectParticipant, showProgrammeFilter,
  sortBy, sortDir, onToggleSort, isAdmin,
}: {
  participants: GroupedParticipant[]
  selectedSession: string
  search: string
  onSearchChange: (v: string) => void
  filterType: string
  onFilterTypeChange: (v: string) => void
  filterProgramme: string
  onFilterProgrammeChange: (v: string) => void
  filterStatut: string
  onFilterStatutChange: (v: string) => void
  onSelectParticipant: (p: GroupedParticipant) => void
  showProgrammeFilter: boolean
  sortBy: SortKey
  sortDir: SortDir
  onToggleSort: (key: SortKey) => void
  isAdmin: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher nom, prénom, centre..."
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={onFilterTypeChange}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="Audio">Audio</SelectItem>
            <SelectItem value="Assistante">Assistante</SelectItem>
          </SelectContent>
        </Select>
        {showProgrammeFilter && (
          <Select value={filterProgramme} onValueChange={onFilterProgrammeChange}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous prog.</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
              <SelectItem value="P3">P3</SelectItem>
              <SelectItem value="P4">P4</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatut} onValueChange={onFilterStatutChange}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Succ / Franchise</SelectItem>
            <SelectItem value="Succursale">Succursale</SelectItem>
            <SelectItem value="Franchise">Franchise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{participants.length}</span> participants
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('nom')}>
                <span className="flex items-center">Nom <SortIcon col="nom" /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('prenom')}>
                <span className="flex items-center">Prénom <SortIcon col="prenom" /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('type')}>
                <span className="flex items-center">Type <SortIcon col="type" /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('statut')}>
                <span className="flex items-center">Statut <SortIcon col="statut" /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('programme')}>
                <span className="flex items-center">Programme <SortIcon col="programme" /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ateliers</th>
              {isAdmin && <th className="p-3 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="text-center p-8 text-muted-foreground">
                  Aucun participant
                </td>
              </tr>
            ) : (
              participants.map((p, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                  onClick={() => onSelectParticipant(p)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{p.nom}</span>
                      {p.sessions.length > 1 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          &times;{p.sessions.length} sessions
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{p.prenom}</td>
                  <td className="p-3 text-muted-foreground">{p.centre || '-'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {[...p.types].map(t => (
                        <Badge key={t} variant="outline" className={t === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                          {t === 'Audio' ? 'Audio' : 'Assist.'}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {[...p.statuts].map(s => (
                        <Badge key={s} variant="outline" className={s === 'Succursale' ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'}>
                          {s === 'Succursale' ? 'Succ.' : 'Franc.'}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.sessions.map((s, i) => (
                        <Badge key={i} variant="outline" className={`text-[10px] ${SESSION_COLORS[s.session?.code] || ''}`}>
                          {s.session?.code?.toUpperCase()} {s.programme !== 'Format rotatif' ? s.programme : ''}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-muted-foreground text-xs">{p.atelierCount} ateliers</span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          const count = p.sessions.length
                          const msg = count > 1
                            ? `Supprimer ${p.prenom} ${p.nom} de toutes les formations (${count} inscriptions) ?`
                            : `Supprimer ${p.prenom} ${p.nom} du listing formations ?`
                          if (!confirm(msg)) return
                          startTransition(async () => {
                            for (const s of p.sessions) {
                              await deleteFormationInscription(s.inscriptionId)
                            }
                            router.refresh()
                          })
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// Ateliers Tab — grouped by type then by session, CLICKABLE cards
// ============================================

function AteliersTab({
  ateliers, sessions, selectedSession, inscriptions, progMappings, onSelectAtelier,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  selectedSession: string
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  onSelectAtelier: (a: FormationAtelierWithSession) => void
}) {
  const types = ['Audio', 'Assistante'] as const
  const etatColors: Record<string, string> = {
    'Terminé': 'text-green-500',
    'En cours': 'text-yellow-500',
    'Pas commencé': 'text-muted-foreground',
  }

  const visibleSessions = selectedSession === 'all'
    ? sessions
    : sessions.filter(s => s.code === selectedSession)

  return (
    <div className="space-y-8">
      {types.map(type => {
        const typeAteliers = ateliers.filter(a => a.type === type)
        if (typeAteliers.length === 0) return null

        return (
          <div key={type}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              {type === 'Audio' ? <Mic2 className="h-4 w-4 text-cyan-500" /> : <Headphones className="h-4 w-4 text-orange-500" />}
              {type === 'Audio' ? 'Audioprothésistes' : 'Assistantes'}
            </h3>

            {visibleSessions.map(session => {
              const sessionTypeAteliers = typeAteliers.filter(a => a.session_id === session.id)
              if (sessionTypeAteliers.length === 0) return null

              return (
                <div key={session.id} className="mb-6">
                  <h4 className={`text-sm font-bold mb-3 ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || 'text-foreground'}`}>
                    {session.label}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sessionTypeAteliers.map(a => {
                      const participantCount = getParticipantsForAtelier(a, inscriptions, progMappings).length

                      return (
                        <Card
                          key={a.id}
                          className="hover:border-primary/40 transition-colors cursor-pointer"
                          onClick={() => onSelectAtelier(a)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="font-semibold text-sm leading-tight">{a.nom}</span>
                              <span className={`text-xs font-medium whitespace-nowrap ${etatColors[a.etat] || ''}`}>{a.etat}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {a.formateur && (
                                <span className="flex items-center gap-1">
                                  <User2 className="h-3 w-3" /> {a.formateur}
                                </span>
                              )}
                              {a.duree && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {a.duree}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[session.code] || ''}`}>
                                {session.code.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                <Users className="h-3 w-3 inline mr-1" />
                                {participantCount} part.
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {ateliers.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Aucun atelier</p>
      )}
    </div>
  )
}

// ============================================
// Programmes Tab — by type, then by session, with ateliers + participant count
// ============================================

function ProgrammesTab({
  sessions, ateliers, inscriptions, progMappings, selectedSession, onSelectProgramme, onSelectAtelier,
}: {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  selectedSession: string
  onSelectProgramme: (session: FormationSession, type: string, programme: string) => void
  onSelectAtelier: (a: FormationAtelierWithSession) => void
}) {
  const types = ['Audio', 'Assistante'] as const
  const visibleSessions = selectedSession === 'all'
    ? sessions
    : sessions.filter(s => s.code === selectedSession)

  return (
    <div className="space-y-8">
      {types.map(type => {
        const typeInscriptions = inscriptions.filter(i => i.type === type)
        if (typeInscriptions.length === 0) return null

        return (
          <div key={type}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              {type === 'Audio' ? <Mic2 className="h-4 w-4 text-cyan-500" /> : <Headphones className="h-4 w-4 text-orange-500" />}
              {type === 'Audio' ? 'Audioprothésistes' : 'Assistantes'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSessions.map(session => {
                const sessionInscriptions = typeInscriptions.filter(i => i.session?.id === session.id)
                if (sessionInscriptions.length === 0) return null

                const programmes = [...new Set(sessionInscriptions.map(i => i.programme))]
                const isRotatif = programmes.length === 1 && programmes[0] === 'Format rotatif'

                const sessionAteliers = ateliers.filter(a => a.session_id === session.id && a.type === type)
                const participantCount = sessionInscriptions.length

                if (isRotatif) {
                  return (
                    <div key={session.id} className="space-y-2">
                      <h4
                        className={`text-sm font-bold cursor-pointer hover:underline ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || ''}`}
                        onClick={() => onSelectProgramme(session, type, 'Format rotatif')}
                      >
                        {session.label}
                        <span className="text-xs font-normal text-muted-foreground ml-2">({participantCount} part.)</span>
                      </h4>
                      <p className="text-[10px] text-muted-foreground italic">
                        FORMAT ROTATIF &mdash; tous les participants {type === 'Audio' ? 'audioprothésistes' : 'assistantes'} font tous les ateliers
                      </p>
                      <div className="space-y-1.5">
                        {sessionAteliers.map(a => (
                          <Card
                            key={a.id}
                            className="bg-card cursor-pointer hover:border-primary/40 transition-colors"
                            onClick={() => onSelectAtelier(a)}
                          >
                            <CardContent className="p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{a.nom}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {a.formateur && <span className="flex items-center gap-1"><User2 className="h-3 w-3" /> {a.formateur}</span>}
                                  {a.duree && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.duree}</span>}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{participantCount} part.</span>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                }

                // P1, P2, P3, P4 programmes
                return (
                  <div key={session.id} className="space-y-3">
                    <h4 className={`text-sm font-bold ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || ''}`}>
                      {session.label}
                    </h4>
                    {programmes.sort().map(prog => {
                      const progParticipants = sessionInscriptions.filter(i => i.programme === prog)
                      const progAteliers = getAteliersForParticipant(session.id, type, prog, ateliers, progMappings)

                      return (
                        <Card
                          key={prog}
                          className={`border-l-4 cursor-pointer hover:border-primary/40 transition-colors ${
                            prog === 'P1' ? 'border-l-cyan-500' :
                            prog === 'P2' ? 'border-l-orange-500' :
                            prog === 'P3' ? 'border-l-green-500' :
                            prog === 'P4' ? 'border-l-yellow-500' : 'border-l-purple-500'
                          }`}
                          onClick={() => onSelectProgramme(session, type, prog)}
                        >
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`font-bold ${PROG_COLORS[prog] || ''}`}>
                                {prog}
                              </Badge>
                              <span className="text-lg font-bold text-muted-foreground/40">{progParticipants.length}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{progParticipants.length} participants</p>
                          </CardHeader>
                          <CardContent className="p-3 pt-0 space-y-1">
                            {progAteliers.map(a => (
                              <div key={a.id} className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  type === 'Audio' ? 'bg-cyan-500' : 'bg-orange-500'
                                }`} />
                                <span>{a.nom}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// Doublons Tab — with EQUIVALENCES/EXCLUSIONS system
// ============================================

interface DoublonsData {
  doublons: {
    nom: string
    prenom: string
    type: string
    centre: string | null
    statuts: Set<string>
    sessions: { session: FormationSession; programme: string; statut: string }[]
    count: number
    atelierDoublons: { name: string; sessions: { code: string; label: string }[] }[]
  }[]
  doublonsWithAteliers: {
    nom: string
    prenom: string
    type: string
    centre: string | null
    statuts: Set<string>
    sessions: { session: FormationSession; programme: string; statut: string }[]
    count: number
    atelierDoublons: { name: string; sessions: { code: string; label: string }[] }[]
  }[]
  multiSessionCount: number
  audioRecurrent: number
  assistanteRecurrent: number
  atelierDoublonCount: number
}

function DoublonsTab({ data, onSelectPerson }: { data: DoublonsData; onSelectPerson: (prenom: string, nom: string) => void }) {
  const [searchD, setSearchD] = useState('')
  const [filterTypeD, setFilterTypeD] = useState<string>('all')

  // Only show people with actual atelier doublons (like the HTML)
  let filtered = data.doublonsWithAteliers
  if (filterTypeD !== 'all') filtered = filtered.filter(d => d.type === filterTypeD)
  if (searchD) {
    const q = searchD.toLowerCase()
    filtered = filtered.filter(d =>
      d.nom.toLowerCase().includes(q) || d.prenom.toLowerCase().includes(q) || (d.centre && d.centre.toLowerCase().includes(q))
    )
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <Card className="bg-purple-500/5 border-purple-500/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-purple-400">Doublons détectés</strong> &mdash; personnes présentes aux deux sessions qui vont refaire (ou ont refait) un atelier équivalent.
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">{data.multiSessionCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Multi-sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-cyan-400">{data.audioRecurrent}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Audios récurrents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-400">{data.assistanteRecurrent}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Assistantes récurrentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-400">{data.atelierDoublonCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              Doublons atelier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Rechercher..."
          value={searchD}
          onChange={e => setSearchD(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filterTypeD} onValueChange={setFilterTypeD}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="Audio">Audio</SelectItem>
            <SelectItem value="Assistante">Assistante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Prénom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, idx) => (
              <tr
                key={idx}
                className="border-b border-border/50 hover:bg-muted/30 align-top cursor-pointer"
                onClick={() => onSelectPerson(d.prenom, d.nom)}
              >
                <td className="p-3">
                  <div>
                    <span className="font-semibold">{d.nom}</span>
                    {d.atelierDoublons.length > 0 && (
                      <span className="ml-1.5 text-red-400 text-[10px] font-medium">
                        <AlertTriangle className="h-3 w-3 inline" /> doublon
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">{d.prenom}</td>
                <td className="p-3 text-muted-foreground">{d.centre || '-'}</td>
                <td className="p-3">
                  <Badge variant="outline" className={d.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                    {d.type === 'Audio' ? 'Audio' : 'Assist.'}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {[...d.statuts].map(s => (
                      <Badge key={s} variant="outline" className={s === 'Succursale' ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'}>
                        {s === 'Succursale' ? 'Succ.' : 'Franc.'}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <div className="space-y-1.5">
                    {/* Session badges */}
                    <div className="flex flex-wrap gap-1">
                      {d.sessions.map((s, i) => (
                        <Badge key={i} variant="outline" className={`text-[10px] ${SESSION_COLORS[s.session?.code] || ''}`}>
                          {s.session?.code?.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                    {/* Atelier doublons */}
                    {d.atelierDoublons.map((ad, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0" />
                        {ad.sessions.map((s, j) => (
                          <span key={j}>
                            {j > 0 && <span className="mx-0.5">&rarr;</span>}
                            <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[s.code] || ''}`}>
                              {s.code.toUpperCase()}
                            </Badge>
                          </span>
                        ))}
                        <span>{ad.name}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Aucun doublon</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
