'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Users, GraduationCap, BookOpen, Award, Search, Trash2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { unenrollMyTeamMember, type FranchiseTeamMember, type TeamMemberInscription } from '@/lib/actions/formations'
import { FranchiseTeamEnroll } from './franchise-team-enroll'
import { ManagerWorkerEnroll } from './manager-worker-enroll'
import type { FormationSession, FormationProgrammeSettingWithCount } from '@/lib/types'

const FILTER_ALL = '__all__'

// Couleurs identiques a WorkerFormationsView pour rester coherent entre vues.
const SESSION_COLORS: Record<string, string> = {
  s22: 'bg-orange-100 text-orange-800 border-orange-200',
  m23: 'bg-pink-100 text-pink-800 border-pink-200',
  s23: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  m24: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  s24: 'bg-purple-100 text-purple-800 border-purple-200',
  m25: 'bg-green-100 text-green-800 border-green-200',
  s25: 'bg-amber-100 text-amber-800 border-amber-200',
  m26: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  s26: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
}

interface Props {
  team: FranchiseTeamMember[]
  inscriptions: TeamMemberInscription[]
  sessions: FormationSession[]       // sessions inscription ouverte
  programmeSettings: FormationProgrammeSettingWithCount[]
  mode: 'franchise' | 'succursale'   // pour customiser libelles + composant d'inscription
}

export function TeamDashboard({ team, inscriptions, sessions, programmeSettings, mode }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterSession, setFilterSession] = useState(FILTER_ALL)
  const [filterType, setFilterType] = useState(FILTER_ALL)
  const [filterCentre, setFilterCentre] = useState(FILTER_ALL)

  const isFranchise = mode === 'franchise'
  const memberLabel = isFranchise ? 'salarié' : 'collaborateur'

  // Set des sessions actuellement inscription ouverte : seules celles-ci
  // doivent etre desinscribables (les sessions passees / fermees ne le sont
  // pas — ca ne sert a rien et c'est confusant).
  const openSessionIds = useMemo(() => new Set(sessions.map((s) => s.id)), [sessions])

  // Map profile_id -> inscriptions[]
  const inscriptionsByMember = useMemo(() => {
    const map = new Map<string, TeamMemberInscription[]>()
    for (const ins of inscriptions) {
      if (!ins.profile_id) continue
      if (!map.has(ins.profile_id)) map.set(ins.profile_id, [])
      map.get(ins.profile_id)!.push(ins)
    }
    return map
  }, [inscriptions])

  // Filtre membres selon search + filtres
  const filteredTeam = useMemo(() => {
    return team.filter((m) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const fullName = `${m.first_name} ${m.last_name}`.toLowerCase()
        if (!fullName.includes(q) && !(m.email ?? '').toLowerCase().includes(q)) {
          return false
        }
      }
      if (filterCentre !== FILTER_ALL && m.location_id !== filterCentre) return false
      // Filtres session/type s'appliquent sur les inscriptions du membre
      if (filterSession !== FILTER_ALL || filterType !== FILTER_ALL) {
        const myIns = inscriptionsByMember.get(m.id) ?? []
        const match = myIns.some((ins) =>
          (filterSession === FILTER_ALL || ins.session_id === filterSession) &&
          (filterType === FILTER_ALL || ins.type === filterType),
        )
        if (!match) return false
      }
      return true
    })
  }, [team, search, filterCentre, filterSession, filterType, inscriptionsByMember])

  // Stats
  const stats = useMemo(() => {
    const totalTeam = team.length
    const activeTeam = team.filter((m) => m.is_active).length
    const totalInscriptions = inscriptions.length
    const dpcCount = inscriptions.filter((i) => i.dpc).length
    const distinctSessions = new Set(inscriptions.map((i) => i.session_id)).size
    return { totalTeam, activeTeam, totalInscriptions, dpcCount, distinctSessions }
  }, [team, inscriptions])

  // Centres uniques (pour le filtre)
  const centres = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of team) {
      if (t.location_id && t.location_name) m.set(t.location_id, t.location_name)
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [team])

  function handleUnenroll(ins: TeamMemberInscription) {
    if (!confirm(`Désinscrire ${ins.prenom} ${ins.nom} de ${ins.session_label} (${ins.type} / ${ins.programme}) ?`)) return
    startTransition(async () => {
      const res = await unenrollMyTeamMember({ inscription_id: ins.id })
      if (!res.ok) {
        toast.error(res.error ?? 'Erreur désinscription')
        return
      }
      toast.success('Désinscrit')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.activeTeam}<span className="text-sm text-muted-foreground">/{stats.totalTeam}</span></p>
            <p className="text-xs text-muted-foreground">Équipe active</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalInscriptions}</p>
            <p className="text-xs text-muted-foreground">Inscriptions</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.distinctSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.dpcCount}</p>
            <p className="text-xs text-muted-foreground">DPC</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Bouton d'inscription en lot (reutilise le dialog existant).
          On passe les inscriptions existantes pour permettre de griser
          les salaries deja inscrits dans le dialog (1 seul programme
          par session+type). */}
      {sessions.length > 0 && (
        isFranchise ? (
          <FranchiseTeamEnroll
            team={team}
            sessions={sessions}
            programmeSettings={programmeSettings}
            existingInscriptions={inscriptions}
          />
        ) : (
          <ManagerWorkerEnroll
            team={team}
            sessions={sessions}
            programmeSettings={programmeSettings}
            existingInscriptions={inscriptions}
          />
        )
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Rechercher un ${memberLabel}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Session" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Toutes sessions</SelectItem>
            {Array.from(new Map(inscriptions.map((i) => [i.session_id, i.session_label])).entries())
              .filter(([, label]) => label)
              .map(([id, label]) => (
                <SelectItem key={id} value={id}>{label}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Tous types</SelectItem>
            <SelectItem value="Audio">Audio</SelectItem>
            <SelectItem value="Assistante">Assistante</SelectItem>
          </SelectContent>
        </Select>
        {centres.length > 1 && (
          <Select value={filterCentre} onValueChange={setFilterCentre}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Centre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>Tous centres</SelectItem>
              {centres.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tableau equipe */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Centre</TableHead>
                <TableHead>Emploi</TableHead>
                <TableHead>Inscriptions</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeam.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun {memberLabel} ne correspond aux filtres
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeam.map((m) => {
                  const myIns = (inscriptionsByMember.get(m.id) ?? [])
                    .filter((i) =>
                      (filterSession === FILTER_ALL || i.session_id === filterSession) &&
                      (filterType === FILTER_ALL || i.type === filterType),
                    )
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.first_name} {m.last_name}</div>
                        {!m.is_active && <Badge variant="secondary" className="text-[10px] mt-0.5">inactif</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.location_name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{m.job_title ?? '—'}</TableCell>
                      <TableCell>
                        {myIns.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {myIns.map((ins) => {
                              const sessionColor = ins.session_code
                                ? (SESSION_COLORS[ins.session_code] ?? '')
                                : ''
                              return (
                                <Badge
                                  key={ins.id}
                                  variant="outline"
                                  className={`text-[10px] ${sessionColor}`}
                                >
                                  {ins.session_code ?? ins.session_label} · {ins.type === 'Audio' ? 'A' : 'As'} · {ins.programme}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* Menu desinscription : uniquement pour les inscriptions
                            sur sessions encore ouvertes (les sessions passees
                            ne sont pas desinscribables). */}
                        {myIns.filter((ins) => openSessionIds.has(ins.session_id)).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {myIns
                                .filter((ins) => openSessionIds.has(ins.session_id))
                                .map((ins) => (
                                  <DropdownMenuItem
                                    key={ins.id}
                                    onClick={() => handleUnenroll(ins)}
                                    disabled={isPending}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Désinscrire de {ins.session_label}
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
