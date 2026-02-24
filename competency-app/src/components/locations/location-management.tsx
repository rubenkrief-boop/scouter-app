'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, MapPin, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { Location } from '@/lib/types'
import { LocationExcelImportDialog } from '@/components/locations/location-excel-import-dialog'

interface LocationManagementProps {
  locations: Location[]
}

export function LocationManagement({ locations }: LocationManagementProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreateLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        address: formData.get('address') || null,
        city: formData.get('city') || null,
        postal_code: formData.get('postal_code') || null,
      }),
    })

    if (res.ok) {
      setIsOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleUpdateLocation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingLocation) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const res = await fetch('/api/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: editingLocation.id,
        name: formData.get('name'),
        address: formData.get('address') || null,
        city: formData.get('city') || null,
        postal_code: formData.get('postal_code') || null,
      }),
    })

    if (res.ok) {
      setEditingLocation(null)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleToggleActive(locationId: string, isActive: boolean) {
    await fetch('/api/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, is_active: !isActive }),
    })
    router.refresh()
  }

  async function handleDeleteLocation(locationId: string) {
    if (!confirm('Voulez-vous vraiment supprimer ce lieu ?')) return

    await fetch(`/api/locations?id=${locationId}`, {
      method: 'DELETE',
    })
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <LocationExcelImportDialog existingLocationNames={locations.map(l => l.name)} />
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-rose-600 hover:bg-rose-700">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un lieu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau lieu d'exercice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateLocation} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du lieu *</Label>
                <Input name="name" required placeholder="Ex: Agence Paris Centre" />
              </div>
              <div className="space-y-2">
                <Label>Adresse</Label>
                <Input name="address" placeholder="Ex: 10 rue de la Paix" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input name="city" placeholder="Ex: Paris" />
                </div>
                <div className="space-y-2">
                  <Label>Code postal</Label>
                  <Input name="postal_code" placeholder="Ex: 75002" />
                </div>
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
                {loading ? 'Ajout...' : 'Ajouter'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingLocation} onOpenChange={(open) => !open && setEditingLocation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le lieu</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateLocation} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du lieu *</Label>
              <Input name="name" required defaultValue={editingLocation?.name} />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input name="address" defaultValue={editingLocation?.address || ''} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input name="city" defaultValue={editingLocation?.city || ''} />
              </div>
              <div className="space-y-2">
                <Label>Code postal</Label>
                <Input name="postal_code" defaultValue={editingLocation?.postal_code || ''} />
              </div>
            </div>
            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {locations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun lieu d'exercice pour le moment.</p>
              <p className="text-sm">Cliquez sur "Ajouter un lieu" pour commencer.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Code postal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {location.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.address || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.city || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.postal_code || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={location.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(location.id, location.is_active)}
                      >
                        {location.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingLocation(location)}
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLocation(location.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
