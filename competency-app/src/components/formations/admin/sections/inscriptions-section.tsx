'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Save, X } from 'lucide-react'
import type { FormationSession, FormationInscriptionWithSession } from '@/lib/types'
import {
  createFormationInscription, deleteFormationInscription,
} from '@/lib/actions/formations'
import type { TeamProfile } from '@/lib/actions/formations'
import { normalizeName } from '@/lib/utils'
import type { ShowMessageFn } from '../hooks/use-admin-message'
import { useInscriptionsGrouping } from '../hooks/use-inscriptions-grouping'

// ============================================
// Inscriptions Section
// ============================================

export function InscriptionsSection({
  inscriptions,
  sessions,
  showMessage,
  isManager,
  teamProfiles,
}: {
  inscriptions: FormationInscriptionWithSession[]
  sessions: FormationSession[]
  showMessage: ShowMessageFn
  isManager: boolean
  teamProfiles: TeamProfile[]
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [form, setForm] = useState({
    session_id: '', nom: '', prenom: '', type: 'Audio' as 'Audio' | 'Assistante',
    statut: 'Succursale' as 'Succursale' | 'Franchise', programme: 'P1', centre: '', dpc: false,
    profile_id: '' as string,
  })
  const [filterSession, setFilterSession] = useState<string>('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  const resetForm = () => {
    setForm({ session_id: '', nom: '', prenom: '', type: 'Audio', statut: 'Succursale', programme: 'P1', centre: '', dpc: false, profile_id: '' })
    setSelectedMemberId('')
    setShowAdd(false)
  }

  // When a team member is selected, auto-fill form fields
  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId)
    if (memberId === 'manual') {
      // Admin manual entry — clear auto-filled fields
      setForm(prev => ({ ...prev, nom: '', prenom: '', centre: '', statut: 'Succursale', profile_id: '' }))
      return
    }
    const member = teamProfiles.find(p => p.id === memberId)
    if (member) {
      const statut = member.role === 'formation_user' ? 'Franchise' as const : 'Succursale' as const
      setForm(prev => ({
        ...prev,
        nom: member.last_name,
        prenom: member.first_name,
        centre: member.location_name || '',
        statut,
        profile_id: member.id,
      }))
    }
  }

  // For managers: only show inscriptions of their team members
  const teamProfileIds = new Set(teamProfiles.map(p => p.id))
  const visibleInscriptions = isManager
    ? inscriptions.filter(i => i.profile_id && teamProfileIds.has(i.profile_id))
    : inscriptions

  // Filter raw inscriptions first
  let filtered = filterSession === 'all' ? visibleInscriptions : visibleInscriptions.filter(i => i.session_id === filterSession)
  if (search) {
    const q = normalizeName(search)
    filtered = filtered.filter(i =>
      normalizeName(i.nom).includes(q) || normalizeName(i.prenom).includes(q) || (i.centre && normalizeName(i.centre).includes(q))
    )
  }

  // Group by unique person
  const grouped = useInscriptionsGrouping(filtered)

  const uniqueCount = grouped.length

  const handleAdd = async () => {
    if (!form.session_id || !form.nom || !form.prenom) return showMessage('error', 'Session, nom et prénom requis')
    // Manager must select a team member
    if (isManager && !form.profile_id) return showMessage('error', 'Veuillez sélectionner un membre de votre équipe')
    const result = await createFormationInscription({
      session_id: form.session_id,
      nom: form.nom,
      prenom: form.prenom,
      type: form.type,
      statut: form.statut,
      programme: form.programme,
      centre: form.centre || undefined,
      dpc: form.dpc,
      profile_id: form.profile_id || undefined,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Inscription créée')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string, nom: string, prenom: string, sessionLabel?: string) => {
    const msg = sessionLabel
      ? `Supprimer l'inscription de ${prenom} ${nom} pour ${sessionLabel} ?`
      : `Supprimer l'inscription de ${prenom} ${nom} ?`
    if (!confirm(msg)) return
    const result = await deleteFormationInscription(id)
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Inscription supprimée')
    router.refresh()
  }

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={filterSession} onValueChange={setFilterSession}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sessions</SelectItem>
              {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="w-[200px]" />
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter inscription
        </Button>
      </div>

      {/* Manager: info about scope restriction */}
      {isManager && (
        <div className="text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
          <span className="font-medium text-blue-600">Périmètre :</span> Vous ne pouvez inscrire que les membres de votre équipe ({teamProfiles.length} collaborateur{teamProfiles.length > 1 ? 's' : ''})
        </div>
      )}

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={form.session_id} onValueChange={v => setForm({ ...form, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Team member selector */}
              <Select value={selectedMemberId} onValueChange={handleSelectMember}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un membre" /></SelectTrigger>
                <SelectContent>
                  {/* Admin can also type manually */}
                  {!isManager && (
                    <SelectItem value="manual">✏️ Saisie manuelle</SelectItem>
                  )}
                  {teamProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.last_name} {p.first_name} {p.location_name ? `(${p.location_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Nom/Prenom: read-only when member selected, editable for manual */}
              {selectedMemberId === 'manual' ? (
                <>
                  <Input placeholder="Nom" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                  <Input placeholder="Prénom" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                </>
              ) : selectedMemberId ? (
                <>
                  <Input value={form.nom} disabled className="bg-muted/50" />
                  <Input value={form.prenom} disabled className="bg-muted/50" />
                </>
              ) : (
                <>
                  <Input placeholder="Nom" value="" disabled className="bg-muted/30" />
                  <Input placeholder="Prénom" value="" disabled className="bg-muted/30" />
                </>
              )}

              <Input placeholder="Centre" value={form.centre} onChange={e => setForm({ ...form, centre: e.target.value })} disabled={!!selectedMemberId && selectedMemberId !== 'manual'} className={selectedMemberId && selectedMemberId !== 'manual' ? 'bg-muted/50' : ''} />
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as 'Audio' | 'Assistante' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Audio">Audio</SelectItem>
                  <SelectItem value="Assistante">Assistante</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.statut} onValueChange={v => setForm({ ...form, statut: v as 'Succursale' | 'Franchise' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Succursale">Succursale</SelectItem>
                  <SelectItem value="Franchise">Franchise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.programme} onValueChange={v => setForm({ ...form, programme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Format rotatif">Format rotatif</SelectItem>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="P3">P3</SelectItem>
                  <SelectItem value="P4">P4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}><Save className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{uniqueCount}</span> participant(s) unique(s)
        {uniqueCount !== filtered.length && (
          <span className="ml-1">({filtered.length} inscriptions)</span>
        )}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Prénom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Centre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Sessions</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Lié</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grouped.slice(0, 100).map(([key, g]) => (
              <Fragment key={key}>
                <tr
                  className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer ${expandedKey === key ? 'bg-muted/40' : ''}`}
                  onClick={() => setExpandedKey(expandedKey === key ? null : key)}
                >
                  <td className="p-3 font-medium">{g.nom}</td>
                  <td className="p-3">{g.prenom}</td>
                  <td className="p-3 text-muted-foreground">{g.centre || '-'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {[...g.types].map(t => (
                        <Badge key={t} variant="outline" className={t === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {g.inscriptions.map((insc, i) => (
                        <Badge key={i} variant="outline" className={`text-[10px] ${SESSION_COLORS[insc.session?.code] || ''}`}>
                          {insc.session?.label} ({insc.programme})
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    {g.profile_id ? (
                      <Badge variant="default" className="text-[10px] bg-green-500/15 text-green-500 border-green-500/30">Oui</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Non</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-[10px] text-muted-foreground">
                      {g.inscriptions.length > 1 ? `${g.inscriptions.length} inscr.` : ''}
                    </span>
                  </td>
                </tr>
                {expandedKey === key && (
                  <tr className="bg-muted/20">
                    <td colSpan={7} className="p-0">
                      <div className="px-6 py-2 space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                          Détail des inscriptions — cliquer pour réduire
                        </p>
                        {g.inscriptions.map(insc => (
                          <div key={insc.id} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/50 text-xs">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={`text-[10px] ${SESSION_COLORS[insc.session?.code] || ''}`}>
                                {insc.session?.label}
                              </Badge>
                              <Badge variant="outline" className={insc.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30 text-[10px]' : 'text-orange-500 border-orange-500/30 text-[10px]'}>
                                {insc.type}
                              </Badge>
                              <span className="text-muted-foreground">{insc.programme}</span>
                              <span className="text-muted-foreground">{insc.statut}</span>
                              {insc.dpc && <Badge variant="secondary" className="text-[10px]">DPC</Badge>}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDelete(insc.id, insc.nom, insc.prenom, insc.session?.label) }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {grouped.length === 0 && (
              <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Aucune inscription</td></tr>
            )}
            {grouped.length > 100 && (
              <tr><td colSpan={7} className="text-center p-4 text-muted-foreground text-xs">
                Affichage limité aux 100 premiers sur {grouped.length} participants
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
