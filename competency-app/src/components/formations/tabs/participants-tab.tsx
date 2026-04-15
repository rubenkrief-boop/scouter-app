'use client'

import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { deleteFormationInscription } from '@/lib/actions/formations'
import { SESSION_COLORS, type GroupedParticipant, type SortKey, type SortDir } from '../formations-helpers'

// ============================================
// Participants Tab
// ============================================

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: SortDir }) {
  if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
  return sortDir === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />
}

export function ParticipantsTab({
  participants, search, onSearchChange,
  filterType, onFilterTypeChange, filterProgramme, onFilterProgrammeChange,
  filterStatut, onFilterStatutChange, onSelectParticipant, showProgrammeFilter,
  sortBy, sortDir, onToggleSort, isAdmin,
}: {
  participants: GroupedParticipant[]
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
                <span className="flex items-center">Nom <SortIcon col="nom" sortBy={sortBy} sortDir={sortDir} /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('prenom')}>
                <span className="flex items-center">Prénom <SortIcon col="prenom" sortBy={sortBy} sortDir={sortDir} /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('type')}>
                <span className="flex items-center">Type <SortIcon col="type" sortBy={sortBy} sortDir={sortDir} /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('statut')}>
                <span className="flex items-center">Statut <SortIcon col="statut" sortBy={sortBy} sortDir={sortDir} /></span>
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider cursor-pointer hover:text-foreground select-none" onClick={() => onToggleSort('programme')}>
                <span className="flex items-center">Programme <SortIcon col="programme" sortBy={sortBy} sortDir={sortDir} /></span>
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
