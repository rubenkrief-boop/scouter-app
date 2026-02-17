import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { LocationManagement } from '@/components/locations/location-management'

export default async function LocationsPage() {
  const supabase = await createClient()

  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true })

  return (
    <div>
      <Header
        title="Lieux d'exercice"
        description="Gerer les centres et agences"
      />
      <div className="p-6">
        <LocationManagement locations={locations ?? []} />
      </div>
    </div>
  )
}
