'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UserCheck, UserX, Pencil, MapPin, UserCog, Search } from 'lucide-react'
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

interface JobProfileOption {
  id: string
  name: string
}

interface UserManagementProps {
  users: Profile[]
  locations: Location[]
  managers: Profile[]
  jobProfiles: JobProfileOption[]
}

export function UserManagement({ users, locations, managers, jobProfiles }: UserManagementProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Controlled state for create form
  const [createRole, setCreateRole] = useState<string>('worker')
  const [createJobTitle, setCreateJobTitle] = useState<string>('none')
  const [createManagerId, setCreateManagerId] = useState<string>('none')
  const [createLocationId, setCreateLocationId] = useState<string>('none')

  // Controlled state for edit form
  const [editRole, setEditRole] = useState<string>('worker')
  const [editJobTitle, setEditJobTitle] = useState<string>('none')
  const [editManagerId, setEditManagerId] = useState<string>('none')
  const [editLocationId, setEditLocationId] = useState<string>('none')

  const filteredUsers = users.filter((user) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
    const email = (user.email ?? '').toLowerCase()
    const jobTitle = (user.job_title ?? '').toLowerCase()
    return fullName.includes(q) || email.includes(q) || jobTitle.includes(q)
  })

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
          job_title: createJobTitle === 'none' ? null : jobProfiles.find(jp => jp.id === createJobTitle)?.name || null,
          manager_id: createManagerId === 'none' ? null : createManagerId,
          location_id: createLocationId === 'none' ? null : createLocationId,
        }),
      })

      if (res.ok) {
        setIsOpen(false)
        setCreateRole('worker')
        setCreateJobTitle('none')
        setCreateManagerId('none')
        setCreateLocationId('none')
        setFormError(null)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        setFormError(err?.error || `Erreur ${res.status}: impossible de créer l'utilisateur`)
      }
    } catch {
      setFormError('Erreur réseau. Vérifiez votre connexion.')
    }
    setLoading(false)
  }

  function openEditDialog(user: Profile) {
    setEditingUser(user)
    setEditRole(user.role || 'worker')
    // Trouver le profil métier correspondant au job_title actuel
    const matchingProfile = jobProfiles.find(jp => jp.name === user.job_title)
    setEditJobTitle(matchingProfile?.id || 'none')
    setEditManagerId(user.manager_id || 'none')
    setEditLocationId(user.location_id || 'none')
    setFormError(null)
  }

  async function handleUpdateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingUser) return
    setLoading(true)
    setFormError(null)

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          role: editRole,
          job_title: editJobTitle === 'none' ? null : jobProfiles.find(jp => jp.id === editJobTitle)?.name || null,
          manager_id: editManagerId === 'none' ? null : editManagerId,
          location_id: editLocationId === 'none' ? null : editLocationId,
        }),
      })

      if (res.ok) {
        setEditingUser(null)
        setFormError(null)
        router.refresh()
      } else {
        const err = await res.json().catch(() => null)
        setFormError(err?.error || `Erreur ${res.status}: impossible de modifier l'utilisateur`)
      }
    } catch {
      setFormError('Erreur réseau. Vérifiez votre connexion.')
    }
    setLoading(false)
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    router.refresh()
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

  function getLocationName(locationId: string | null) {
    if (!locationId) return null
    const location = locations.find(l => l.id === locationId)
    return location?.name || null
  }

  return (
    <div className="space-y-4">
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
        <span className="text-sm text-muted-foreground">
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
                <Input name="password" type="password" minLength={6} required />
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
                    <SelectItem value="worker">Collaborateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Emploi / Poste</Label>
                <Select value={createJobTitle} onValueChange={setCreateJobTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un emploi..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun emploi</SelectItem>
                    {jobProfiles.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>
                        {jp.name}
                      </SelectItem>
                    ))}
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
                <Label>Lieu d'exercice</Label>
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

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="font-medium">{editingUser.first_name} {editingUser.last_name}</p>
                <p className="text-sm text-muted-foreground">{editingUser.email}</p>
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
                    <SelectItem value="worker">Collaborateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Emploi / Poste</Label>
                <Select value={editJobTitle} onValueChange={setEditJobTitle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un emploi..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun emploi</SelectItem>
                    {jobProfiles.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>
                        {jp.name}
                      </SelectItem>
                    ))}
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
                <Label>Lieu d'exercice</Label>
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
                    {getManagerName(user.manager_id) ? (
                      <div className="flex items-center gap-1 text-sm">
                        <UserCog className="h-3 w-3 text-muted-foreground" />
                        {getManagerName(user.manager_id)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
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
                      >
                        <Pencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        title={user.is_active ? 'Desactiver' : 'Activer'}
                      >
                        {user.is_active ? (
                          <UserX className="h-4 w-4 text-red-500" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
