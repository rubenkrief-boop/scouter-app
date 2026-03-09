'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Users, Mic2, Headphones, Building2, Briefcase, GraduationCap, Search, AlertTriangle, Settings, X, Clock, User2 } from 'lucide-react'
import Link from 'next/link'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { FormationStats, ProgrammeAtelierMapping } from '@/lib/actions/formations'

// ============================================
// Color mappings
// ============================================

const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  m23: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  s23: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  m24: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  s24: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  m25: 'bg-green-500/15 text-green-400 border-green-500/30',
  s25: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  m26: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}

const PROG_COLORS: Record<string, string> = {
  P1: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  P2: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  P3: 'bg-green-500/15 text-green-400 border-green-500/30',
  P4: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'Format rotatif': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

// ============================================
// Types
// ============================================

interface GroupedParticipant {
  nom: string
  prenom: string
  centre: string | null
  dpc: boolean
  profile_id: string | null
  sessions: { session: FormationSession; programme: string; type: string; statut: string }[]
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
    // Format rotatif: all ateliers of this type in this session
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  // Programme P1-P4: use the mapping
  const mappedAtelierIds = new Set(
    progMappings
      .filter(m => m.session_id === sessionId && m.type === type && m.programme === programme)
      .map(m => m.atelier_id)
  )

  if (mappedAtelierIds.size === 0) {
    // Fallback: if no mapping exists, return all ateliers (like rotatif)
    return ateliers.filter(a => a.session_id === sessionId && a.type === type)
  }

  return ateliers.filter(a => mappedAtelierIds.has(a.id))
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

  // Filtered inscriptions
  const filteredInscriptions = useMemo(() => {
    let result = inscriptions
    if (selectedSession !== 'all') {
      result = result.filter(i => i.session?.code === selectedSession)
    }
    if (filterType !== 'all') result = result.filter(i => i.type === filterType)
    if (filterProgramme !== 'all') result = result.filter(i => i.programme === filterProgramme)
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
  }, [inscriptions, selectedSession, search, filterType, filterProgramme, filterStatut])

  // Grouped participants (unique persons combining all sessions)
  const groupedParticipants = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
    const byKey: Record<string, GroupedParticipant> = {}

    for (const i of filteredInscriptions) {
      const key = `${normalize(i.prenom)}|${normalize(i.nom)}`
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
      g.sessions.push({ session: i.session, programme: i.programme, type: i.type, statut: i.statut })
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

    return Object.values(byKey).sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
    )
  }, [filteredInscriptions, ateliers, progAtelierMappings])

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

  // Doublons: multi-session persons + atelier doublons detection
  const doublonsData = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
    const byKey: Record<string, { inscriptions: FormationInscriptionWithSession[] }> = {}

    for (const i of inscriptions) {
      const k = `${normalize(i.prenom)}|${normalize(i.nom)}|${i.type}`
      if (!byKey[k]) byKey[k] = { inscriptions: [] }
      byKey[k].inscriptions.push(i)
    }

    // Only keep multi-session persons
    const multiSession = Object.values(byKey).filter(g => g.inscriptions.length > 1)

    // Detect atelier doublons
    let atelierDoublonCount = 0
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

      // Find duplicate atelier names across sessions
      const atelierDoublons: { name: string; sessions: { code: string; label: string }[] }[] = []
      const atelierByName: Record<string, { code: string; label: string }[]> = {}
      for (const sa of sessionAteliers) {
        for (const name of sa.atelierNames) {
          const nName = normalize(name)
          if (!atelierByName[nName]) atelierByName[nName] = []
          atelierByName[nName].push({ code: sa.session.code, label: sa.session.label })
        }
      }
      for (const [, sessionsForAtelier] of Object.entries(atelierByName)) {
        if (sessionsForAtelier.length > 1) {
          const name = Object.keys(atelierByName).find(k => atelierByName[k] === sessionsForAtelier) || ''
          atelierDoublons.push({ name, sessions: sessionsForAtelier })
          atelierDoublonCount++
        }
      }

      return {
        nom, prenom, type, centre, statuts,
        sessions: insc.map(i => ({ session: i.session, programme: i.programme, statut: i.statut })),
        count: insc.length,
        atelierDoublons,
      }
    })

    return {
      doublons,
      multiSessionCount: multiSession.length,
      audioRecurrent: multiSession.filter(g => g.inscriptions[0].type === 'Audio').length,
      assistanteRecurrent: multiSession.filter(g => g.inscriptions[0].type === 'Assistante').length,
      atelierDoublonCount,
    }
  }, [inscriptions, ateliers, progAtelierMappings])

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
          onClick={() => setSelectedSession('all')}
          className="text-xs font-semibold tracking-wider"
        >
          TOUTES
        </Button>
        {sessions.map(s => (
          <Button
            key={s.code}
            variant={selectedSession === s.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedSession(s.code)}
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
        />
      )}

      {activeTab === 'ateliers' && (
        <AteliersTab ateliers={filteredAteliers} sessions={sessions} selectedSession={selectedSession} inscriptions={filteredInscriptions} />
      )}

      {activeTab === 'programmes' && (
        <ProgrammesTab
          sessions={sessions}
          ateliers={ateliers}
          inscriptions={filteredInscriptions}
          progMappings={progAtelierMappings}
          selectedSession={selectedSession}
        />
      )}

      {activeTab === 'doublons' && (
        <DoublonsTab data={doublonsData} />
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
  participant, allInscriptions, ateliers, sessions, progMappings, onClose,
}: {
  participant: GroupedParticipant
  allInscriptions: FormationInscriptionWithSession[]
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  progMappings: ProgrammeAtelierMapping[]
  onClose: () => void
}) {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

  // Get ALL inscriptions for this person (unfiltered)
  const personKey = `${normalize(participant.prenom)}|${normalize(participant.nom)}`
  const personInscriptions = allInscriptions.filter(i => {
    const k = `${normalize(i.prenom)}|${normalize(i.nom)}`
    return k === personKey
  }).sort((a, b) => (a.session?.sort_order ?? 0) - (b.session?.sort_order ?? 0))

  const types = [...new Set(personInscriptions.map(i => i.type))]
  const statuts = [...new Set(personInscriptions.map(i => i.statut))]

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
                {types.map(t => t === 'Audio' ? 'Audioprothésiste' : 'Assistante').join(' · ')}
                {' · '}
                {statuts.join(' · ')}
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
                  <Badge variant="outline" className={`text-xs ${PROG_COLORS[insc.programme] || ''}`}>
                    {insc.programme}
                  </Badge>
                </div>

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
// Participants Tab
// ============================================

function ParticipantsTab({
  participants, selectedSession, search, onSearchChange,
  filterType, onFilterTypeChange, filterProgramme, onFilterProgrammeChange,
  filterStatut, onFilterStatutChange, onSelectParticipant,
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
}) {
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
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Prénom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Programme</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Ateliers</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground">
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
// Ateliers Tab — grouped by type then by session
// ============================================

function AteliersTab({
  ateliers, sessions, selectedSession, inscriptions,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  selectedSession: string
  inscriptions: FormationInscriptionWithSession[]
}) {
  const types = ['Audio', 'Assistante'] as const
  const etatColors: Record<string, string> = {
    'Terminé': 'text-green-500',
    'En cours': 'text-yellow-500',
    'Pas commencé': 'text-muted-foreground',
  }

  // Sessions to show (all or selected)
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

              // Count participants for this session + type
              const participantCount = inscriptions.filter(i =>
                i.session?.id === session.id && i.type === type
              ).length

              return (
                <div key={session.id} className="mb-6">
                  <h4 className={`text-sm font-bold mb-3 ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || 'text-foreground'}`}>
                    {session.label}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sessionTypeAteliers.map(a => (
                      <Card key={a.id} className="hover:border-primary/40 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-semibold text-sm leading-tight">{a.nom}</span>
                            <span className={`text-xs font-medium ${etatColors[a.etat] || ''}`}>{a.etat}</span>
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
                          <div className="flex items-center gap-1.5 mt-2">
                            <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[session.code] || ''}`}>
                              {session.code.toUpperCase()}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
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
  sessions, ateliers, inscriptions, progMappings, selectedSession,
}: {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  progMappings: ProgrammeAtelierMapping[]
  selectedSession: string
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

                // Check if this session is "Format rotatif" (all participants same programme)
                const programmes = [...new Set(sessionInscriptions.map(i => i.programme))]
                const isRotatif = programmes.length === 1 && programmes[0] === 'Format rotatif'

                const sessionAteliers = ateliers.filter(a => a.session_id === session.id && a.type === type)
                const participantCount = sessionInscriptions.length

                if (isRotatif) {
                  return (
                    <div key={session.id} className="space-y-2">
                      <h4 className={`text-sm font-bold ${SESSION_COLORS[session.code]?.split(' ').find(c => c.startsWith('text-')) || ''}`}>
                        {session.label}
                      </h4>
                      <p className="text-[10px] text-muted-foreground italic">
                        FORMAT ROTATIF &mdash; tous les participants {type === 'Audio' ? 'audioprothésistes' : 'assistantes'} font tous les ateliers
                      </p>
                      <div className="space-y-1.5">
                        {sessionAteliers.map(a => (
                          <Card key={a.id} className="bg-card">
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
                        <Card key={prog} className={`border-l-4 ${
                          prog === 'P1' ? 'border-l-cyan-500' :
                          prog === 'P2' ? 'border-l-orange-500' :
                          prog === 'P3' ? 'border-l-green-500' :
                          prog === 'P4' ? 'border-l-yellow-500' : 'border-l-purple-500'
                        }`}>
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
// Doublons Tab — with stats + atelier doublon detection
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
  multiSessionCount: number
  audioRecurrent: number
  assistanteRecurrent: number
  atelierDoublonCount: number
}

function DoublonsTab({ data }: { data: DoublonsData }) {
  const [searchD, setSearchD] = useState('')
  const [filterTypeD, setFilterTypeD] = useState<string>('all')

  let filtered = data.doublons
  if (filterTypeD !== 'all') filtered = filtered.filter(d => d.type === filterTypeD)
  if (searchD) {
    const q = searchD.toLowerCase()
    filtered = filtered.filter(d =>
      d.nom.toLowerCase().includes(q) || d.prenom.toLowerCase().includes(q) || (d.centre && d.centre.toLowerCase().includes(q))
    )
  }

  // Count doublons with atelier issues
  const withAtelierDoublons = data.doublons.filter(d => d.atelierDoublons.length > 0)

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
            <p className="text-2xl font-bold text-red-400">{withAtelierDoublons.length}</p>
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
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 align-top">
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
