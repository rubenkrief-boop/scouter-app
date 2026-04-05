'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, MapPin, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getPlannerLocations, setPlannerLocations } from '@/lib/actions/visits'
import type { Profile, Location } from '@/lib/types'

interface PlannerAttributionEditorProps {
  planners: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'role'>[]
  locations: Pick<Location, 'id' | 'name'>[]
}

export function PlannerAttributionEditor({ planners, locations }: PlannerAttributionEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedPlanner, setSelectedPlanner] = useState('')
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // Load assignments when planner changes
  useEffect(() => {
    if (!selectedPlanner) {
      setAssignedIds(new Set())
      return
    }
    setLoading(true)
    getPlannerLocations(selectedPlanner).then(ids => {
      setAssignedIds(new Set(ids))
      setLoading(false)
    })
  }, [selectedPlanner])

  function toggleLocation(locationId: string) {
    setAssignedIds(prev => {
      const next = new Set(prev)
      if (next.has(locationId)) next.delete(locationId)
      else next.add(locationId)
      return next
    })
  }

  function handleSave() {
    if (!selectedPlanner) return
    startTransition(async () => {
      const result = await setPlannerLocations(selectedPlanner, Array.from(assignedIds))
      if (result.success) {
        toast.success('Attributions mises a jour')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Erreur')
      }
    })
  }

  const selectedProfile = planners.find(p => p.id === selectedPlanner)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Attributions centres / planificateurs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Attribuez des centres a chaque planificateur pour definir son perimetre de visites et ses objectifs.
          Les managers ont automatiquement acces aux centres de leur equipe.
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un planificateur..." />
              </SelectTrigger>
              <SelectContent>
                {planners.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                    <span className="text-muted-foreground ml-2 text-xs">({p.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlanner && (
            <Button onClick={handleSave} disabled={isPending} size="sm">
              {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
          )}
        </div>

        {selectedPlanner && !loading && (
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">
                Centres attribues a {selectedProfile?.first_name} {selectedProfile?.last_name}
              </p>
              <Badge variant="secondary" className="text-xs">
                {assignedIds.size} / {locations.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
              {locations.map(loc => (
                <label
                  key={loc.id}
                  className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={assignedIds.has(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{loc.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
