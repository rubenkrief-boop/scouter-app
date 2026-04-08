'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle } from 'lucide-react'
import type { FormationSession } from '@/lib/types'
import { normalizeName } from '@/lib/utils'
import { SESSION_COLORS } from '../formations-helpers'

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

export function DoublonsTab({ data, onSelectPerson }: { data: DoublonsData; onSelectPerson: (prenom: string, nom: string) => void }) {
  const [searchD, setSearchD] = useState('')
  const [filterTypeD, setFilterTypeD] = useState<string>('all')

  // Only show people with actual atelier doublons (like the HTML)
  let filtered = data.doublonsWithAteliers
  if (filterTypeD !== 'all') filtered = filtered.filter(d => d.type === filterTypeD)
  if (searchD) {
    const q = normalizeName(searchD)
    filtered = filtered.filter(d =>
      normalizeName(d.nom).includes(q) || normalizeName(d.prenom).includes(q) || (d.centre && normalizeName(d.centre).includes(q))
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
