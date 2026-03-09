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
  GraduationCap, Users, Calendar, Mic2, Headphones,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FormationSession, FormationAtelierWithSession, FormationInscriptionWithSession } from '@/lib/types'
import {
  createFormationSession, updateFormationSession, deleteFormationSession,
  createFormationAtelier, updateFormationAtelier, deleteFormationAtelier,
  createFormationInscription, updateFormationInscription, deleteFormationInscription,
  autoLinkInscriptions,
} from '@/lib/actions/formations'

interface FormationsAdminProps {
  sessions: FormationSession[]
  ateliers: FormationAtelierWithSession[]
  inscriptions: FormationInscriptionWithSession[]
  isSuperAdmin: boolean
}

export function FormationsAdmin({ sessions, ateliers, inscriptions, isSuperAdmin }: FormationsAdminProps) {
  const [activeSection, setActiveSection] = useState<'sessions' | 'ateliers' | 'inscriptions'>('sessions')
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
        <InscriptionsSection inscriptions={inscriptions} sessions={sessions} showMessage={showMessage} />
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
}: {
  inscriptions: FormationInscriptionWithSession[]
  sessions: FormationSession[]
  showMessage: (type: 'success' | 'error', text: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [form, setForm] = useState({
    session_id: '', nom: '', prenom: '', type: 'Audio' as 'Audio' | 'Assistante',
    statut: 'Succursale' as 'Succursale' | 'Franchise', programme: 'P1', centre: '', dpc: false,
  })
  const [filterSession, setFilterSession] = useState<string>('all')
  const [search, setSearch] = useState('')
  const router = useRouter()

  const resetForm = () => {
    setForm({ session_id: '', nom: '', prenom: '', type: 'Audio', statut: 'Succursale', programme: 'P1', centre: '', dpc: false })
    setShowAdd(false)
  }

  // Filter raw inscriptions first
  let filtered = filterSession === 'all' ? inscriptions : inscriptions.filter(i => i.session_id === filterSession)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(i =>
      i.nom.toLowerCase().includes(q) || i.prenom.toLowerCase().includes(q) || (i.centre && i.centre.toLowerCase().includes(q))
    )
  }

  // Group by unique person
  const grouped = (() => {
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
    const byKey: Record<string, GroupedAdminParticipant> = {}
    for (const i of filtered) {
      const key = `${normalize(i.prenom)}|${normalize(i.nom)}`
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
    const result = await createFormationInscription({
      session_id: form.session_id,
      nom: form.nom,
      prenom: form.prenom,
      type: form.type,
      statut: form.statut,
      programme: form.programme,
      centre: form.centre || undefined,
      dpc: form.dpc,
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
              <Input placeholder="Nom" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
              <Input placeholder="Prénom" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
              <Input placeholder="Centre" value={form.centre} onChange={e => setForm({ ...form, centre: e.target.value })} />
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
