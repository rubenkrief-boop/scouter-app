import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { LocationManagement } from '@/components/locations/location-management'
import { getGeographicZones } from '@/lib/actions/geographic-zones'

export default async function LocationsPage() {
  const supabase = await createClient()

  const [{ data: locations }, zones] = await Promise.all([
    supabase.from('locations').select('*').order('name', { ascending: true }),
    getGeographicZones(),
  ])

  return (
    <div>
      <Header
        title="Lieux d'exercice"
        description="Gerer les centres et agences"
      />
      <div className="p-6">
        <LocationManagement locations={locations ?? []} zones={zones} />
      </div>
    </div>
  )
}
