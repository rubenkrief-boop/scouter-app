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

interface UserManagementProps {
  users: Profile[]
  locations: Location[]
  managers: Profile[]
}

export function UserManagement({ users, locations, managers }: UserManagementProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

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
    const formData = new FormData(e.currentTarget)

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        role: formData.get('role'),
        job_title: formData.get('job_title') || null,
        manager_id: formData.get('manager_id') === 'none' ? null : formData.get('manager_id') || null,
        location_id: formData.get('location_id') === 'none' ? null : formData.get('location_id') || null,
      }),
    })

    if (res.ok) {
      setIsOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleUpdateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingUser) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editingUser.id,
        role: formData.get('role'),
        job_title: formData.get('job_title') || null,
        manager_id: formData.get('manager_id') === 'none' ? null : formData.get('manager_id') || null,
        location_id: formData.get('location_id') === 'none' ? null : formData.get('location_id') || null,
      }),
    })

    if (res.ok) {
      setEditingUser(null)
      router.refresh()
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
                <Select name="role" defaultValue="worker">
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
                <Input name="job_title" placeholder="Ex: Audioprothésiste, Assistante technique..." />
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select name="manager_id">
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
                <Select name="location_id">
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
                <Select name="role" defaultValue={editingUser.role}>
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
                <Input name="job_title" defaultValue={editingUser.job_title || ''} placeholder="Ex: Audioprothésiste, Assistante technique..." />
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select name="manager_id" defaultValue={editingUser.manager_id || 'none'}>
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
                <Select name="location_id" defaultValue={editingUser.location_id || 'none'}>
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
                        onClick={() => setEditingUser(user)}
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
