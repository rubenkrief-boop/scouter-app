'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Plus, Pencil, Trash2, Save, X, Upload, Link2,
  GraduationCap, Users, Calendar, Mic2, Headphones, FileText,
  Eye, ToggleLeft, ToggleRight, Download,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession,
  FormationProgrammeSettingWithCount, FormationProgrammeFile, FormationType,
} from '@/lib/types'
import {
  createFormationSession, updateFormationSession, deleteFormationSession,
  createFormationAtelier, updateFormationAtelier, deleteFormationAtelier,
  createFormationInscription, updateFormationInscription, deleteFormationInscription,
  autoLinkInscriptions,
  upsertFormationProgrammeSetting, deleteFormationProgrammeSetting,
  toggleSessionRegistration,
} from '@/lib/actions/formations'
import type { TeamProfile } from '@/lib/actions/formations'
import { normalizeName } from '@/lib/utils'

interface FormationsAdminProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  programmeFiles: FormationProgrammeFile[]
  isSuperAdmin: boolean
  isManager: boolean
  currentUserId: string
  teamProfiles: TeamProfile[]
}

export function FormationsAdmin({ sessions, ateliers, inscriptions, programmeSettings, programmeFiles, isSuperAdmin, isManager, currentUserId, teamProfiles }: FormationsAdminProps) {
  const [activeSection, setActiveSection] = useState<'sessions' | 'ateliers' | 'inscriptions' | 'programmes'>('sessions')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const sections = [
    { id: 'sessions' as const, label: 'Sessions', icon: Calendar, count: sessions.length },
    { id: 'ateliers' as const, label: 'Ateliers', icon: GraduationCap, count: ateliers.length },
    { id: 'inscriptions' as const, label: 'Inscriptions', icon: Users, count: inscriptions.length },
    { id: 'programmes' as const, label: 'Programmes', icon: FileText, count: programmeSettings.length },
  ]

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link href="/formations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Retour au dashboard
        </Link>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <SeedButton showMessage={showMessage} />
          )}
          <AutoLinkButton showMessage={showMessage} />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-border">
        {sections.map(sec => {
          const Icon = sec.icon
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeSection === sec.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {sec.label}
              <Badge variant="secondary" className="text-[10px] ml-1">{sec.count}</Badge>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeSection === 'sessions' && (
        <SessionsSection sessions={sessions} showMessage={showMessage} />
      )}
      {activeSection === 'ateliers' && (
        <AteliersSection ateliers={ateliers} sessions={sessions} showMessage={showMessage} />
      )}
      {activeSection === 'inscriptions' && (
        <InscriptionsSection inscriptions={inscriptions} sessions={sessions} showMessage={showMessage} isManager={isManager} currentUserId={currentUserId} teamProfiles={teamProfiles} />
      )}
      {activeSection === 'programmes' && (
        <ProgrammesSection
          sessions={sessions}
          programmeSettings={programmeSettings}
          programmeFiles={programmeFiles}
          showMessage={showMessage}
        />
      )}
    </div>
  )
}

// ============================================
// Seed Button
// ============================================

function SeedButton({ showMessage }: { showMessage: (type: 'success' | 'error', text: string) => void }) {
  const [loading, setLoading] = useState(false)

  const handleSeed = async () => {
    if (!confirm('Importer les données de formation depuis le fichier seed ? Les données existantes avec le même code seront mises à jour.')) return

    setLoading(true)
    try {
      const res = await fetch('/api/formations/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        showMessage('success', `Import terminé : ${data.results.sessions} sessions, ${data.results.ateliers} ateliers, ${data.results.inscriptions} inscriptions, ${data.results.linked} profils liés`)
        window.location.reload()
      } else {
        showMessage('error', data.error || 'Erreur lors de l\'import')
      }
    } catch {
      showMessage('error', 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSeed} disabled={loading}>
      <Upload className="h-4 w-4 mr-1" />
      {loading ? 'Import...' : 'Importer seed'}
    </Button>
  )
}

// ============================================
// Auto-link Button
// ============================================

function AutoLinkButton({ showMessage }: { showMessage: (type: 'success' | 'error', text: string) => void }) {
  const [loading, setLoading] = useState(false)

  const handleLink = async () => {
    setLoading(true)
    try {
      const result = await autoLinkInscriptions()
      showMessage('success', `${result.linked} inscription(s) liée(s) aux profils`)
      if (result.linked > 0) window.location.reload()
    } catch {
      showMessage('error', 'Erreur lors du lien automatique')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLink} disabled={loading}>
      <Link2 className="h-4 w-4 mr-1" />
      {loading ? 'Liaison...' : 'Auto-lier profils'}
    </Button>
  )
}

// ============================================
// Sessions Section
// ============================================

function SessionsSection({
  sessions,
  showMessage,
}: {
  sessions: FormationSession[]
  showMessage: (type: 'success' | 'error', text: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: '', label: '', date_info: '', sort_order: '0' })
  const router = useRouter()

  const resetForm = () => {
    setForm({ code: '', label: '', date_info: '', sort_order: '0' })
    setShowAdd(false)
    setEditId(null)
  }

  const handleAdd = async () => {
    if (!form.code || !form.label) return showMessage('error', 'Code et label requis')
    const result = await createFormationSession({
      code: form.code,
      label: form.label,
      date_info: form.date_info || undefined,
      sort_order: parseInt(form.sort_order) || 0,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session créée')
    resetForm()
    router.refresh()
  }

  const handleEdit = async (id: string) => {
    const result = await updateFormationSession(id, {
      label: form.label,
      date_info: form.date_info || undefined,
      sort_order: parseInt(form.sort_order) || 0,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session mise à jour')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Supprimer la session "${label}" et toutes ses données ?`)) return
    const result = await deleteFormationSession(id)
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Session supprimée')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter session
        </Button>
      </div>

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Code (ex: s26)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
              <Input placeholder="Label (ex: SEPT 2026)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
              <Input placeholder="Date info" value={form.date_info} onChange={e => setForm({ ...form, date_info: e.target.value })} />
              <Input placeholder="Ordre" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleAdd}><Save className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Code</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Label</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Date</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Ordre</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Actif</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                {editId === s.id ? (
                  <>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3"><Input className="h-8 text-sm" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></td>
                    <td className="p-3"><Input className="h-8 text-sm" value={form.date_info} onChange={e => setForm({ ...form, date_info: e.target.value })} /></td>
                    <td className="p-3"><Input className="h-8 text-sm w-20" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></td>
                    <td className="p-3"><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Oui' : 'Non'}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(s.id)}><Save className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetForm}><X className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3 font-medium">{s.label}</td>
                    <td className="p-3 text-muted-foreground">{s.date_info || '-'}</td>
                    <td className="p-3">{s.sort_order}</td>
                    <td className="p-3"><Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Oui' : 'Non'}</Badge></td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                          setForm({ code: s.code, label: s.label, date_info: s.date_info || '', sort_order: String(s.sort_order) })
                          setEditId(s.id)
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id, s.label)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Aucune session</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// Ateliers Section
// ============================================

function AteliersSection({
  ateliers,
  sessions,
  showMessage,
}: {
  ateliers: FormationAtelierWithSession[]
  sessions: FormationSession[]
  showMessage: (type: 'success' | 'error', text: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    session_id: '', nom: '', formateur: '', duree: '', type: 'Audio' as 'Audio' | 'Assistante',
    etat: 'Pas commencé' as 'Terminé' | 'En cours' | 'Pas commencé', programmes: '',
  })
  const [filterSession, setFilterSession] = useState<string>('all')
  const router = useRouter()

  const resetForm = () => {
    setForm({ session_id: '', nom: '', formateur: '', duree: '', type: 'Audio', etat: 'Pas commencé', programmes: '' })
    setShowAdd(false)
  }

  const filtered = filterSession === 'all' ? ateliers : ateliers.filter(a => a.session_id === filterSession)

  const handleAdd = async () => {
    if (!form.session_id || !form.nom) return showMessage('error', 'Session et nom requis')
    const result = await createFormationAtelier({
      session_id: form.session_id,
      nom: form.nom,
      formateur: form.formateur || undefined,
      duree: form.duree || undefined,
      type: form.type,
      etat: form.etat,
      programmes: form.programmes || undefined,
    })
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Atelier créé')
    resetForm()
    router.refresh()
  }

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer l'atelier "${nom}" ?`)) return
    const result = await deleteFormationAtelier(id)
    if (result.error) return showMessage('error', result.error)
    showMessage('success', 'Atelier supprimé')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sessions</SelectItem>
            {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter atelier
        </Button>
      </div>

      {showAdd && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Select value={form.session_id} onValueChange={v => setForm({ ...form, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
                <SelectContent>
                  {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Nom de l'atelier" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
              <Input placeholder="Formateur" value={form.formateur} onChange={e => setForm({ ...form, formateur: e.target.value })} />
              <Input placeholder="Durée" value={form.duree} onChange={e => setForm({ ...form, duree: e.target.value })} />
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as 'Audio' | 'Assistante' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Audio">Audio</SelectItem>
                  <SelectItem value="Assistante">Assistante</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.etat} onValueChange={v => setForm({ ...form, etat: v as 'Terminé' | 'En cours' | 'Pas commencé' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pas commencé">Pas commencé</SelectItem>
                  <SelectItem value="En cours">En cours</SelectItem>
                  <SelectItem value="Terminé">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Programmes (ex: P1 & P2)" value={form.programmes} onChange={e => setForm({ ...form, programmes: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}><Save className="h-3.5 w-3.5 mr-1" /> Créer</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-3.5 w-3.5 mr-1" /> Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{filtered.length}</span> atelier(s)
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Nom</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Session</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Type</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">Formateur</th>
              <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase">État</th>
              <th className="text-right p-3 font-medium text-muted-foreground text-xs uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="p-3 font-medium">{a.nom}</td>
                <td className="p-3 text-muted-foreground text-xs">{a.session?.label || '-'}</td>
                <td className="p-3">
                  <Badge variant="outline" className={a.type === 'Audio' ? 'text-cyan-500 border-cyan-500/30' : 'text-orange-500 border-orange-500/30'}>
                    {a.type}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{a.formateur || '-'}</td>
                <td className="p-3">
                  <Badge variant="outline" className={
                    a.etat === 'Terminé' ? 'text-green-500 border-green-500/30' :
                    a.etat === 'En cours' ? 'text-yellow-500 border-yellow-500/30' :
                    'text-muted-foreground'
                  }>
                    {a.etat}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id, a.nom)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Aucun atelier</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// Inscriptions Section
// ============================================

interface GroupedAdminParticipant {
  nom: string
  prenom: string
  centre: string | null
  profile_id: string | null
  types: Set<string>
  statuts: Set<string>
  dpc: boolean
  inscriptions: FormationInscriptionWithSession[]
}

function InscriptionsSection({
  inscriptions,
  sessions,
  showMessage,
  isManager,
  currentUserId,
  teamProfiles,
}: {
  inscriptions: FormationInscriptionWithSession[]
  sessions: FormationSession[]
  showMessage: (type: 'success' | 'error', text: string) => void
  isManager: boolean
  currentUserId: string
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
    const q = search.toLowerCase()
    filtered = filtered.filter(i =>
      i.nom.toLowerCase().includes(q) || i.prenom.toLowerCase().includes(q) || (i.centre && i.centre.toLowerCase().includes(q))
    )
  }

  // Group by unique person
  const grouped = (() => {
    const byKey: Record<string, GroupedAdminParticipant> = {}
    for (const i of filtered) {
      const key = `${normalizeName(i.prenom)}|${normalizeName(i.nom)}`
      if (!byKey[key]) {
        byKey[key] = {
          nom: i.nom, prenom: i.prenom, centre: i.centre, profile_id: i.profile_id,
          types: new Set(), statuts: new Set(), dpc: false, inscriptions: [],
        }
      }
      const g = byKey[key]
      if (i.centre) g.centre = i.centre
      g.types.add(i.type)
      g.statuts.add(i.statut)
      if (i.dpc) g.dpc = true
      if (i.profile_id) g.profile_id = i.profile_id
      g.inscriptions.push(i)
    }
    return Object.entries(byKey).sort(([, a], [, b]) =>
      a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')
    )
  })()

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
              <>
                <tr
                  key={key}
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
                  <tr key={`${key}-detail`} className="bg-muted/20">
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
              </>
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

// ============================================
// Section: Programmes (capacité, fichiers, salles)
// ============================================

const PROGRAMME_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'Format rotatif']

function ProgrammesSection({
  sessions,
  programmeSettings,
  programmeFiles,
  showMessage,
}: {
  sessions: FormationSession[]
  programmeSettings: FormationProgrammeSettingWithCount[]
  programmeFiles: FormationProgrammeFile[]
  showMessage: (type: 'success' | 'error', text: string) => void
}) {
  const [selectedSession, setSelectedSession] = useState<string>(sessions[0]?.id || '')
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState<string | null>(null) // 'Audio' | 'Assistante' | null
  const [addingType, setAddingType] = useState<FormationType | null>(null)
  const [addProgramme, setAddProgramme] = useState('')
  const [addMaxPlaces, setAddMaxPlaces] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMaxPlaces, setEditMaxPlaces] = useState('')
  const [editSalle, setEditSalle] = useState('')
  const router = useRouter()

  const session = sessions.find(s => s.id === selectedSession)
  const sessionSettings = programmeSettings.filter(s => s.session_id === selectedSession)
  const sessionFiles = programmeFiles.filter(f => f.session_id === selectedSession)

  const audioFile = sessionFiles.find(f => f.type === 'Audio')
  const assistanteFile = sessionFiles.find(f => f.type === 'Assistante')
  const audioSettings = sessionSettings.filter(s => s.type === 'Audio')
  const assistanteSettings = sessionSettings.filter(s => s.type === 'Assistante')

  async function handleFileUpload(type: FormationType, file: File) {
    setUploading(type)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', selectedSession)
    formData.append('type', type)

    try {
      const res = await fetch('/api/formations/programme-file', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        showMessage('error', json.error || 'Erreur upload')
      } else {
        showMessage('success', `Fichier ${type} uploadé`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur réseau')
    } finally {
      setUploading(null)
    }
  }

  async function handleFileDelete(type: FormationType) {
    if (!confirm(`Supprimer le fichier programme ${type} ?`)) return
    try {
      const res = await fetch(
        `/api/formations/programme-file?session_id=${selectedSession}&type=${type}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        showMessage('error', 'Erreur suppression')
      } else {
        showMessage('success', `Fichier ${type} supprimé`)
        router.refresh()
      }
    } catch {
      showMessage('error', 'Erreur réseau')
    }
  }

  function handleToggleRegistration() {
    if (!session) return
    startTransition(async () => {
      const result = await toggleSessionRegistration(selectedSession, !session.registration_open)
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', session.registration_open ? 'Inscriptions fermées' : 'Inscriptions ouvertes')
        router.refresh()
      }
    })
  }

  function handleAddSetting(type: FormationType) {
    if (!addProgramme || !addMaxPlaces) return
    startTransition(async () => {
      const result = await upsertFormationProgrammeSetting({
        session_id: selectedSession,
        type,
        programme: addProgramme,
        max_places: parseInt(addMaxPlaces) || 0,
      })
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', `Programme ${addProgramme} (${type}) configuré`)
        setAddingType(null)
        setAddProgramme('')
        setAddMaxPlaces('')
        router.refresh()
      }
    })
  }

  function handleSaveEdit(setting: FormationProgrammeSettingWithCount) {
    startTransition(async () => {
      const result = await upsertFormationProgrammeSetting({
        session_id: setting.session_id,
        type: setting.type,
        programme: setting.programme,
        max_places: parseInt(editMaxPlaces) || 0,
        salle: editSalle || undefined,
      })
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', 'Mis à jour')
        setEditingId(null)
        router.refresh()
      }
    })
  }

  function handleDeleteSetting(id: string) {
    if (!confirm('Supprimer cette configuration ?')) return
    startTransition(async () => {
      const result = await deleteFormationProgrammeSetting(id)
      if ('error' in result && result.error) {
        showMessage('error', result.error)
      } else {
        showMessage('success', 'Configuration supprimée')
        router.refresh()
      }
    })
  }

  function getCapacityColor(current: number, max: number) {
    if (max === 0) return 'text-muted-foreground'
    const pct = current / max
    if (pct >= 1) return 'text-red-600'
    if (pct >= 0.7) return 'text-orange-500'
    return 'text-emerald-600'
  }

  function renderFileCard(type: FormationType, file: FormationProgrammeFile | undefined) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-2">
          {type === 'Audio' ? (
            <Mic2 className="h-4 w-4 text-cyan-500" />
          ) : (
            <Headphones className="h-4 w-4 text-orange-500" />
          )}
          <span className="text-sm font-medium">Programme {type}</span>
        </div>
        {file ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground max-w-[200px] truncate">{file.file_name}</span>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Eye className="h-3 w-3 mr-1" /> Voir
              </Button>
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-500 hover:text-red-600"
              onClick={() => handleFileDelete(type)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(type, f)
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" className="h-7" asChild disabled={!!uploading}>
              <span>
                <Upload className="h-3 w-3 mr-1" />
                {uploading === type ? 'Upload...' : 'Uploader'}
              </span>
            </Button>
          </label>
        )}
      </div>
    )
  }

  function renderSettingsTable(type: FormationType, settings: FormationProgrammeSettingWithCount[]) {
    const existingProgrammes = settings.map(s => s.programme)
    const availableProgrammes = PROGRAMME_OPTIONS.filter(p => !existingProgrammes.includes(p))

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            {type === 'Audio' ? <Mic2 className="h-3.5 w-3.5 text-cyan-500" /> : <Headphones className="h-3.5 w-3.5 text-orange-500" />}
            Capacités {type}
          </h4>
          {availableProgrammes.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setAddingType(type)
                setAddProgramme(availableProgrammes[0])
                setAddMaxPlaces('20')
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-1.5 px-2">Programme</th>
              <th className="text-center py-1.5 px-2">Max</th>
              <th className="text-center py-1.5 px-2">Inscrits</th>
              <th className="text-center py-1.5 px-2">Dispo</th>
              <th className="text-left py-1.5 px-2">Salle</th>
              <th className="text-right py-1.5 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.map(s => {
              const isEditing = editingId === s.id
              const dispo = s.max_places === 0 ? '∞' : Math.max(0, s.max_places - s.current_count)
              const capacityColor = getCapacityColor(s.current_count, s.max_places)

              return (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2 px-2">
                    <Badge variant="outline" className="text-xs">{s.programme}</Badge>
                  </td>
                  <td className="text-center py-2 px-2">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={editMaxPlaces}
                        onChange={e => setEditMaxPlaces(e.target.value)}
                        className="h-7 w-16 text-center text-xs mx-auto"
                      />
                    ) : (
                      <span className="text-xs">{s.max_places === 0 ? '∞' : s.max_places}</span>
                    )}
                  </td>
                  <td className={`text-center py-2 px-2 font-semibold text-xs ${capacityColor}`}>
                    {s.current_count}
                  </td>
                  <td className={`text-center py-2 px-2 text-xs ${capacityColor}`}>
                    {dispo}
                  </td>
                  <td className="py-2 px-2">
                    {isEditing ? (
                      <Input
                        value={editSalle}
                        onChange={e => setEditSalle(e.target.value)}
                        placeholder="Ex: Salle B2"
                        className="h-7 text-xs w-32"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{s.salle || '—'}</span>
                    )}
                  </td>
                  <td className="text-right py-2 px-2">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleSaveEdit(s)} disabled={isPending}>
                          <Save className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setEditingId(s.id)
                            setEditMaxPlaces(String(s.max_places))
                            setEditSalle(s.salle || '')
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500"
                          onClick={() => handleDeleteSetting(s.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {/* Add row */}
            {addingType === type && (
              <tr className="border-b border-border/50 bg-muted/30">
                <td className="py-2 px-2">
                  <Select value={addProgramme} onValueChange={setAddProgramme}>
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProgrammes.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="text-center py-2 px-2">
                  <Input
                    type="number"
                    min={0}
                    value={addMaxPlaces}
                    onChange={e => setAddMaxPlaces(e.target.value)}
                    className="h-7 w-16 text-center text-xs mx-auto"
                  />
                </td>
                <td colSpan={2} />
                <td />
                <td className="text-right py-2 px-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleAddSetting(type)} disabled={isPending}>
                      <Save className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setAddingType(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
            {settings.length === 0 && addingType !== type && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted-foreground text-xs">
                  Aucune configuration de programme
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Session selector + registration toggle */}
      <div className="flex items-center gap-3">
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.label} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {session && (
          <Button
            variant={session.registration_open ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleRegistration}
            disabled={isPending}
            className={session.registration_open ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {session.registration_open ? (
              <><ToggleRight className="h-4 w-4 mr-1.5" /> Inscriptions ouvertes</>
            ) : (
              <><ToggleLeft className="h-4 w-4 mr-1.5" /> Inscriptions fermées</>
            )}
          </Button>
        )}
      </div>

      {!selectedSession ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sélectionnez une session</p>
      ) : (
        <div className="space-y-6">
          {/* File uploads */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Fichiers programme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderFileCard('Audio', audioFile)}
              {renderFileCard('Assistante', assistanteFile)}
            </CardContent>
          </Card>

          {/* Capacity settings */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Capacités & Salles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderSettingsTable('Audio', audioSettings)}
              <Separator />
              {renderSettingsTable('Assistante', assistanteSettings)}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
