'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Users, Mic2, Headphones, Building2, Briefcase, GraduationCap, Search, AlertTriangle, Settings } from 'lucide-react'
import Link from 'next/link'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import type { FormationStats } from '@/lib/actions/formations'

// ============================================
// Session color mapping
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

interface GroupedParticipant {
  nom: string
  prenom: string
  centre: string | null
  type: string
  statut: string
  dpc: boolean
  profile_id: string | null
  sessions: { session: FormationSession; programme: string; type: string; statut: string }[]
  types: Set<string>
  statuts: Set<string>
}

interface FormationsDashboardProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  stats: FormationStats
  isAdmin: boolean
}

export function FormationsDashboard({ sessions, ateliers, inscriptions, stats, isAdmin }: FormationsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'participants' | 'ateliers' | 'programmes' | 'doublons'>('participants')
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterProgramme, setFilterProgramme] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')

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
          nom: i.nom,
          prenom: i.prenom,
          centre: i.centre,
          type: i.type,
          statut: i.statut,
          dpc: i.dpc,
          profile_id: i.profile_id,
          sessions: [],
          types: new Set<string>(),
          statuts: new Set<string>(),
        }
      }
      const g = byKey[key]
      // Keep most recent centre (non-null)
      if (i.centre && !g.centre) g.centre = i.centre
      if (i.centre) g.centre = i.centre
      g.types.add(i.type)
      g.statuts.add(i.statut)
      if (i.dpc) g.dpc = true
      if (i.profile_id) g.profile_id = i.profile_id
      g.sessions.push({
        session: i.session,
        programme: i.programme,
        type: i.type,
        statut: i.statut,
      })
    }

    // Sort by nom then prenom
    return Object.values(byKey).sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
    )
  }, [filteredInscriptions])

  // Filtered ateliers
  const filteredAteliers = useMemo(() => {
    if (selectedSession === 'all') return ateliers
    return ateliers.filter(a => a.session?.code === selectedSession)
  }, [ateliers, selectedSession])

  // Stats based on unique persons (grouped)
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
    // Programme stats still count inscriptions (a person in P1 + P2 counts for both)
    for (const g of groupedParticipants) {
      const progs = new Set(g.sessions.map(s => s.programme))
      for (const p of progs) {
        s.byProgramme[p] = (s.byProgramme[p] || 0) + 1
      }
    }
    return s
  }, [groupedParticipants])

  // Doublons detection
  const doublons = useMemo(() => {
    const byKey: Record<string, FormationInscriptionWithSession[]> = {}
    for (const i of inscriptions) {
      const k = `${i.prenom.toLowerCase().trim()}-${i.nom.toLowerCase().trim()}-${i.type}`
      if (!byKey[k]) byKey[k] = []
      byKey[k].push(i)
    }
    return Object.values(byKey).filter(group => group.length > 1).map(group => ({
      nom: group[0].nom,
      prenom: group[0].prenom,
      type: group[0].type,
      sessions: group.map(g => ({
        session: g.session,
        programme: g.programme,
        statut: g.statut,
      })),
      count: group.length,
    }))
  }, [inscriptions])

  const tabs = [
    { id: 'participants' as const, label: 'Participants', icon: Users },
    { id: 'ateliers' as const, label: 'Ateliers', icon: GraduationCap },
    { id: 'programmes' as const, label: 'Programmes', icon: Briefcase },
    { id: 'doublons' as const, label: `Doublons (${doublons.length})`, icon: AlertTriangle },
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
          sessions={sessions}
          selectedSession={selectedSession}
          search={search}
          onSearchChange={setSearch}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          filterProgramme={filterProgramme}
          onFilterProgrammeChange={setFilterProgramme}
          filterStatut={filterStatut}
          onFilterStatutChange={setFilterStatut}
        />
      )}

      {activeTab === 'ateliers' && (
        <AteliersTab ateliers={filteredAteliers} sessions={sessions} selectedSession={selectedSession} />
      )}

      {activeTab === 'programmes' && (
        <ProgrammesTab inscriptions={filteredInscriptions} />
      )}

      {activeTab === 'doublons' && (
        <DoublonsTab doublons={doublons} />
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
// Participants Tab
// ============================================

function ParticipantsTab({
  participants, sessions, selectedSession, search, onSearchChange,
  filterType, onFilterTypeChange, filterProgramme, onFilterProgrammeChange,
  filterStatut, onFilterStatutChange,
}: {
  participants: GroupedParticipant[]
  sessions: FormationSession[]
  selectedSession: string
  search: string
  onSearchChange: (v: string) => void
  filterType: string
  onFilterTypeChange: (v: string) => void
  filterProgramme: string
  onFilterProgrammeChange: (v: string) => void
  filterStatut: string
  onFilterStatutChange: (v: string) => void
}) {
  const isSingleSession = selectedSession !== 'all'

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Rechercher nom, prenom, centre..."
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
        <Select value={filterProgramme} onValueChange={onFilterProgrammeChange}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous programmes</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
            <SelectItem value="P4">P4</SelectItem>
            <SelectItem value="Format rotatif">Format rotatif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatut} onValueChange={onFilterStatutChange}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="Succursale">Succursale</SelectItem>
            <SelectItem value="Franchise">Franchise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{participants.length}</span> participant(s) unique(s)
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Prenom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
              {isSingleSession ? (
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Programme</th>
              ) : (
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-muted-foreground">
                  Aucun participant
                </td>
              </tr>
            ) : (
              participants.map((p, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.nom}</td>
                  <td className="p-3">{p.prenom}</td>
                  <td className="p-3 text-muted-foreground">{p.centre || '-'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {[...p.types].map(t => (
                        <Badge key={t} variant="outline" className={t === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {[...p.statuts].map(s => (
                        <Badge key={s} variant="outline" className={s === 'Succursale' ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  {isSingleSession ? (
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(p.sessions.map(s => s.programme))].map(prog => (
                          <Badge key={prog} variant="outline" className={PROG_COLORS[prog] || ''}>
                            {prog}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  ) : (
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {p.sessions.map((s, i) => (
                          <Badge key={i} variant="outline" className={`text-[10px] ${SESSION_COLORS[s.session?.code] || ''}`}>
                            {s.session?.label} ({s.programme})
                          </Badge>
                        ))}
                      </div>
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
// Ateliers Tab
// ============================================

function AteliersTab({
  ateliers, sessions, selectedSession,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  selectedSession: string
}) {
  // Group by type
  const audioAteliers = ateliers.filter(a => a.type === 'Audio')
  const assistanteAteliers = ateliers.filter(a => a.type === 'Assistante')

  return (
    <div className="space-y-6">
      {audioAteliers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-cyan-500" />
            Audioprothesistes ({audioAteliers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {audioAteliers.map(a => (
              <AtelierCard key={a.id} atelier={a} showSession={selectedSession === 'all'} />
            ))}
          </div>
        </div>
      )}

      {assistanteAteliers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Headphones className="h-4 w-4 text-orange-500" />
            Assistantes ({assistanteAteliers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {assistanteAteliers.map(a => (
              <AtelierCard key={a.id} atelier={a} showSession={selectedSession === 'all'} />
            ))}
          </div>
        </div>
      )}

      {ateliers.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Aucun atelier</p>
      )}
    </div>
  )
}

function AtelierCard({ atelier, showSession }: { atelier: FormationAtelierWithSession; showSession: boolean }) {
  const etatColors: Record<string, string> = {
    'Terminé': 'bg-green-500/15 text-green-500 border-green-500/30',
    'En cours': 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
    'Pas commencé': 'bg-muted text-muted-foreground border-border',
  }

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{atelier.nom}</CardTitle>
          <Badge variant="outline" className={etatColors[atelier.etat] || ''}>
            {atelier.etat}
          </Badge>
        </div>
        {atelier.formateur && (
          <p className="text-xs text-muted-foreground">{atelier.formateur}</p>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {atelier.duree && (
            <Badge variant="secondary" className="text-[10px]">{atelier.duree}</Badge>
          )}
          {atelier.programmes && (
            <Badge variant="outline" className="text-[10px]">{atelier.programmes}</Badge>
          )}
          {showSession && atelier.session && (
            <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[atelier.session.code] || ''}`}>
              {atelier.session.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Programmes Tab
// ============================================

function ProgrammesTab({ inscriptions }: { inscriptions: FormationInscriptionWithSession[] }) {
  const programmes = ['P1', 'P2', 'P3', 'P4', 'Format rotatif']

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {programmes.map(prog => {
        const participants = inscriptions.filter(i => i.programme === prog)
        const audio = participants.filter(i => i.type === 'Audio').length
        const assistante = participants.filter(i => i.type === 'Assistante').length

        return (
          <Card key={prog}>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-sm font-bold ${PROG_COLORS[prog] || ''}`}>
                  {prog}
                </Badge>
                <span className="text-2xl font-bold text-muted-foreground/30">{participants.length}</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Mic2 className="h-3.5 w-3.5 text-cyan-500" /> Audio
                </span>
                <span className="font-medium">{audio}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Headphones className="h-3.5 w-3.5 text-orange-500" /> Assistantes
                </span>
                <span className="font-medium">{assistante}</span>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                {participants.length} participant(s) au total
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ============================================
// Doublons Tab
// ============================================

interface DoublonEntry {
  nom: string
  prenom: string
  type: string
  sessions: { session: FormationSession; programme: string; statut: string }[]
  count: number
}

function DoublonsTab({ doublons }: { doublons: DoublonEntry[] }) {
  if (doublons.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Aucun doublon detecte</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="bg-purple-500/5 border-purple-500/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong className="text-purple-400">{doublons.length}</strong> participant(s) inscrit(s) dans plusieurs sessions.
          Verifiez les doublons d&apos;ateliers potentiels.
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Prenom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessions</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nb</th>
            </tr>
          </thead>
          <tbody>
            {doublons.map((d, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3 font-medium">{d.nom}</td>
                <td className="p-3">{d.prenom}</td>
                <td className="p-3">
                  <Badge variant="outline" className={d.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                    {d.type}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {d.sessions.map((s, i) => (
                      <Badge key={i} variant="outline" className={`text-[10px] ${SESSION_COLORS[s.session?.code] || ''}`}>
                        {s.session?.label} ({s.programme})
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="bg-purple-500/15 text-purple-400 border-purple-500/30">
                    {d.count}x
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
