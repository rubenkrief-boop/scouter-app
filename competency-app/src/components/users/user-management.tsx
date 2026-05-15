'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UserCheck, UserX, Pencil, MapPin, UserCog, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/utils-app/roles'
import type { Profile, UserRole, Location } from '@/lib/types'
import { ExcelImportDialog } from '@/components/users/excel-import-dialog'

interface JobProfileLite {
  id: string
  name: string
}

interface UserManagementProps {
  users: Profile[]
  locations: Location[]
  managers: Profile[]
  jobProfiles: JobProfileLite[]
  /** location_id -> liste des gerants affectes a ce centre via
   *  centre_managers (N-a-N). Permet d'afficher TOUS les co-gerants
   *  d'un centre dans la colonne Manager du tableau. */
  managersByLocation: Record<string, Array<{ id: string; name: string }>>
}

// Etend un payload d'erreur API en un message lisible utilisateur :
//   - Si zod a retourne `details.fieldErrors`, on les concatene
//     ("password: le mot de passe doit contenir au moins 8 caracteres")
//   - Sinon on tombe sur err.error (texte libre) puis fallback HTTP status.
function formatApiError(
  err: { error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null,
  status: number,
  verb: 'creer' | 'modifier',
): string {
  const fieldErrors = err?.details?.fieldErrors
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field} : ${msgs.join(', ')}`)
      .join(' • ')
  }
  return err?.error || `Erreur ${status} : impossible de ${verb} l'utilisateur`
}

const FILTER_ALL = '__all__'

export function UserManagement({ users, locations, managers, jobProfiles, managersByLocation }: UserManagementProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Filtres rapides
  const [filterRole, setFilterRole] = useState<string>(FILTER_ALL)
  const [filterStatut, setFilterStatut] = useState<string>(FILTER_ALL)
  const [filterJob, setFilterJob] = useState<string>(FILTER_ALL)
  const [filterLocation, setFilterLocation] = useState<string>(FILTER_ALL)
  const [filterActive, setFilterActive] = useState<string>(FILTER_ALL)

  // Controlled state for create form
  const [createRole, setCreateRole] = useState<string>('worker')
  const [createManagerId, setCreateManagerId] = useState<string>('none')
  const [createLocationId, setCreateLocationId] = useState<string>('none')

  // Controlled state for edit form
  const [editRole, setEditRole] = useState<string>('worker')
  const [editManagerId, setEditManagerId] = useState<string>('none')
  const [editLocationId, setEditLocationId] = useState<string>('none')
  const [editFirstName, setEditFirstName] = useState<string>('')
  const [editLastName, setEditLastName] = useState<string>('')
  const [editJobTitle, setEditJobTitle] = useState<string>('')
  const [editJobProfileId, setEditJobProfileId] = useState<string>('none')
  const [editStatut, setEditStatut] = useState<string>('succursale')
  const [editEmail, setEditEmail] = useState<string>('')
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null)

  // Liste des emplois distincts pour le dropdown (case-insensitive, trim)
  const distinctJobs = Array.from(
    new Set(
      users
        .map((u) => (u.job_title ?? '').trim())
        .filter((v) => v.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'fr'))

  const filteredUsers = users.filter((user) => {
    // Search texte libre
    if (search.trim()) {
      const q = search.toLowerCase()
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
      const email = (user.email ?? '').toLowerCase()
      const jobTitle = (user.job_title ?? '').toLowerCase()
      if (!fullName.includes(q) && !email.includes(q) && !jobTitle.includes(q)) {
        return false
      }
    }
    // Filtres dropdown
    if (filterRole !== FILTER_ALL && user.role !== filterRole) return false
    if (filterStatut !== FILTER_ALL) {
      const userStatut = (user as Profile & { statut?: string }).statut || 'succursale'
      if (userStatut !== filterStatut) return false
    }
    if (filterJob !== FILTER_ALL) {
      if (filterJob === '__none__') {
        if ((user.job_title ?? '').trim().length > 0) return false
      } else if ((user.job_title ?? '').trim() !== filterJob) {
        return false
      }
    }
    if (filterLocation !== FILTER_ALL) {
      if (filterLocation === '__none__') {
        if (user.location_id !== null) return false
      } else if (user.location_id !== filterLocation) {
        return false
      }
    }
    if (filterActive !== FILTER_ALL) {
      const wantActive = filterActive === 'active'
      if (user.is_active !== wantActive) return false
    }
    return true
  })

  function resetFilters() {
    setSearch('')
    setFilterRole(FILTER_ALL)
    setFilterStatut(FILTER_ALL)
    setFilterJob(FILTER_ALL)
    setFilterLocation(FILTER_ALL)
    setFilterActive(FILTER_ALL)
  }

  const hasActiveFilter =
    search.trim() !== '' ||
    filterRole !== FILTER_ALL ||
    filterStatut !== FILTER_ALL ||
    filterJob !== FILTER_ALL ||
    filterLocation !== FILTER_ALL ||
    filterActive !== FILTER_ALL

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFormError(null)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
          first_name: formData.get('first_name'),
          last_name: formData.get('last_name'),
          role: createRole,
          manager_id: createManagerId === 'none' ? null : createManagerId,
          location_id: createLocationId === 'none' ? null : createLocationId,
        }),
      })

      if (res.ok) {
        setIsOpen(false)
        setCreateRole('worker')
        setCreateManagerId('none')
        setCreateLocationId('none')
        setFormError(null)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        setFormError(formatApiError(err, res.status, 'creer'))
      }
    } catch {
      setFormError('Erreur reseau. Verifiez votre connexion.')
    }
    setLoading(false)
  }

  function openEditDialog(user: Profile) {
    setEditingUser(user)
    setEditRole(user.role || 'worker')
    setEditManagerId(user.manager_id || 'none')
    setEditLocationId(user.location_id || 'none')
    setEditFirstName(user.first_name || '')
    setEditLastName(user.last_name || '')
    setEditJobTitle(user.job_title || '')
    setEditJobProfileId(user.job_profile_id || 'none')
    setEditStatut((user as Profile & { statut?: string }).statut || 'succursale')
    setEditEmail(user.email || '')
    setFormError(null)
  }

  async function handleUpdateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingUser) return
    setLoading(true)
    setFormError(null)

    try {
      // On envoie chaque champ uniquement s'il a changé pour éviter
      // de rejeter en cas de validation Zod (ex: email pas modifié mais
      // déjà invalide en base ne doit pas bloquer un autre changement).
      const payload: Record<string, unknown> = { userId: editingUser.id }
      if (editRole !== editingUser.role) payload.role = editRole
      if ((editManagerId === 'none' ? null : editManagerId) !== editingUser.manager_id) {
        payload.manager_id = editManagerId === 'none' ? null : editManagerId
      }
      if ((editLocationId === 'none' ? null : editLocationId) !== editingUser.location_id) {
        payload.location_id = editLocationId === 'none' ? null : editLocationId
      }
      if (editFirstName !== (editingUser.first_name || '')) payload.first_name = editFirstName
      if (editLastName !== (editingUser.last_name || '')) payload.last_name = editLastName
      if (editJobTitle !== (editingUser.job_title || '')) payload.job_title = editJobTitle || null
      const currentJobProfileId = editingUser.job_profile_id || null
      const nextJobProfileId = editJobProfileId === 'none' ? null : editJobProfileId
      if (nextJobProfileId !== currentJobProfileId) payload.job_profile_id = nextJobProfileId
      const currentStatut = (editingUser as Profile & { statut?: string }).statut || 'succursale'
      if (editStatut !== currentStatut) payload.statut = editStatut
      if (editEmail !== (editingUser.email || '')) payload.email = editEmail

      if (Object.keys(payload).length === 1) {
        // Rien à mettre à jour
        setEditingUser(null)
        setFormError(null)
        setLoading(false)
        return
      }

      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setEditingUser(null)
        setFormError(null)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        setFormError(formatApiError(err, res.status, 'modifier'))
      }
    } catch {
      setFormError('Erreur reseau. Verifiez votre connexion.')
    }
    setLoading(false)
  }

  async function handleDeleteUser() {
    if (!pendingDelete) return
    setLoading(true)
    setFormError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingDelete.id }),
      })
      if (res.ok) {
        setPendingDelete(null)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        setFormError(err?.error || `Erreur ${res.status} : impossible de supprimer`)
      }
    } catch {
      setFormError('Erreur reseau. Verifiez votre connexion.')
    }
    setLoading(false)
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, is_active: !isActive }),
    })
    router.refresh()
  }

  function getManagerName(managerId: string | null) {
    if (!managerId) return null
    const manager = managers.find(m => m.id === managerId)
    return manager ? `${manager.first_name} ${manager.last_name}` : null
  }

  /** Pour la colonne Manager du tableau : on prefere afficher TOUS les
   *  gerants du centre (via centre_managers N-a-N), ce qui couvre les
   *  co-gerants. Fallback sur manager_id si le centre n'a aucun gerant
   *  affecte (ou si le user n'a pas de location). */
  function getCentreManagersForUser(user: Profile): string[] {
    if (user.location_id) {
      const mgrs = managersByLocation[user.location_id]
      if (mgrs && mgrs.length > 0) return mgrs.map(m => m.name)
    }
    const fallback = getManagerName(user.manager_id)
    return fallback ? [fallback] : []
  }

  function getLocationName(locationId: string | null) {
    if (!locationId) return null
    const location = locations.find(l => l.id === locationId)
    return location?.name || null
  }

  return (
    <div className="space-y-4">
      {/* Ligne recherche + compteur + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredUsers.length} / {users.length} utilisateur{users.length > 1 ? 's' : ''}
        </span>
        <div className="flex gap-2 ml-auto">
        <ExcelImportDialog locations={locations} />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-2" />
              Creer un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvel utilisateur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prenom *</Label>
                  <Input name="first_name" required />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input name="last_name" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe *</Label>
                <Input name="password" type="password" minLength={8} required />
                <p className="text-xs text-muted-foreground">
                  Au moins 8 caracteres.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={createRole} onValueChange={setCreateRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Administrateur</SelectItem>
                    <SelectItem value="skill_master">Skill Master</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="resp_audiologie">Responsable audiologie</SelectItem>
                    <SelectItem value="worker">Collaborateur</SelectItem>
                    <SelectItem value="gerant_franchise">Gérant franchisé</SelectItem>
                    <SelectItem value="formation_user">Utilisateur Formations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={createManagerId} onValueChange={setCreateManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun manager</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lieu d&apos;exercice</Label>
                <Select value={createLocationId} onValueChange={setCreateLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun lieu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun lieu</SelectItem>
                    {locations.filter(l => l.is_active).map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {formError}
                </div>
              )}
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
                {loading ? 'Creation...' : 'Creer'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Ligne filtres rapides */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Tous les rôles</SelectItem>
            <SelectItem value="super_admin">Administrateur</SelectItem>
            <SelectItem value="skill_master">Skill Master</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="resp_audiologie">Resp. Audiologie</SelectItem>
            <SelectItem value="worker">Collaborateur</SelectItem>
            <SelectItem value="formation_user">Utilisateur Formations</SelectItem>
            <SelectItem value="gerant_franchise">Gérant franchisé</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Tous statuts</SelectItem>
            <SelectItem value="succursale">Succursale</SelectItem>
            <SelectItem value="franchise">Franchise</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Tous emplois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Tous emplois</SelectItem>
            {distinctJobs.map((job) => (
              <SelectItem key={job} value={job}>{job}</SelectItem>
            ))}
            <SelectItem value="__none__">(emploi vide)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="Tous lieux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Tous lieux</SelectItem>
            {locations.filter((l) => l.is_active).map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
            <SelectItem value="__none__">(sans lieu)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Actif et inactif" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Actif + Inactif</SelectItem>
            <SelectItem value="active">Actif uniquement</SelectItem>
            <SelectItem value="inactive">Inactif uniquement</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;utilisateur</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prenom</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Changer l&apos;email modifie aussi le compte auth ; l&apos;utilisateur
                  devra se reconnecter avec le nouveau mail.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Emploi</Label>
                <Select
                  value={editJobProfileId}
                  onValueChange={(v) => {
                    setEditJobProfileId(v)
                    // Synchronise job_title avec le nom du profil metier
                    // selectionne pour rester coherent dans l'affichage table.
                    if (v === 'none') {
                      setEditJobTitle('')
                    } else {
                      const jp = jobProfiles.find((p) => p.id === v)
                      if (jp) setEditJobTitle(jp.name)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun emploi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun emploi</SelectItem>
                    {jobProfiles.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>{jp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  L&apos;emploi selectionne pilote la grille de competences a evaluer.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Administrateur</SelectItem>
                    <SelectItem value="skill_master">Skill Master</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="resp_audiologie">Responsable audiologie</SelectItem>
                    <SelectItem value="worker">Collaborateur</SelectItem>
                    <SelectItem value="formation_user">Utilisateur Formations</SelectItem>
                    <SelectItem value="gerant_franchise">Gérant franchisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={editStatut} onValueChange={setEditStatut}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="succursale">Succursale</SelectItem>
                    <SelectItem value="franchise">Franchise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={editManagerId} onValueChange={setEditManagerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun manager</SelectItem>
                    {managers.filter(m => m.id !== editingUser.id).map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.first_name} {manager.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lieu d&apos;exercice</Label>
                <Select value={editLocationId} onValueChange={setEditLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun lieu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun lieu</SelectItem>
                    {locations.filter(l => l.is_active).map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {formError}
                </div>
              )}
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Emploi</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={ROLE_COLORS[user.role as UserRole]}>
                      {ROLE_LABELS[user.role as UserRole]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.job_title || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const mgrNames = getCentreManagersForUser(user)
                      if (mgrNames.length === 0) {
                        return <span className="text-muted-foreground text-sm">-</span>
                      }
                      return (
                        <div className="flex flex-col gap-0.5 text-sm">
                          {mgrNames.map((name, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <UserCog className="h-3 w-3 text-muted-foreground" />
                              {name}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    {getLocationName(user.location_id) ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {getLocationName(user.location_id)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                        title="Modifier"
                        aria-label="Modifier l'utilisateur"
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        title={user.is_active ? 'Desactiver' : 'Activer'}
                        aria-label={user.is_active ? "Desactiver l'utilisateur" : "Activer l'utilisateur"}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDelete(user)}
                        title="Supprimer"
                        aria-label="Supprimer l'utilisateur"
                      >
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de confirmation suppression */}
      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer definitivement ?</DialogTitle>
          </DialogHeader>
          {pendingDelete && (
            <div className="space-y-4">
              <p className="text-sm">
                Voulez-vous vraiment supprimer{' '}
                <strong>
                  {pendingDelete.first_name} {pendingDelete.last_name}
                </strong>{' '}
                ({pendingDelete.email}) ?
              </p>
              <p className="text-xs text-muted-foreground">
                Cette action est irreversible. Les inscriptions formation liees
                a cet utilisateur vont conserver le snapshot nom/prenom mais
                perdre le lien profile_id.
              </p>
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={loading}>
                  Annuler
                </Button>
                <Button
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={handleDeleteUser}
                  disabled={loading}
                >
                  {loading ? 'Suppression...' : 'Supprimer definitivement'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
