import { Header } from '@/components/layout/header'
import { ChartColorsEditor } from '@/components/settings/chart-colors-editor'
import { ScouterDemo } from '@/components/settings/scouter-demo'
import { CompanyBrandingEditor } from '@/components/settings/company-branding-editor'
import { ZoneConfigEditor } from '@/components/visits/zone-config-editor'
import { PlannerAttributionEditor } from '@/components/visits/planner-attribution-editor'
import { getGeographicZones } from '@/lib/actions/geographic-zones'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()

  const [zones, { data: planners }, { data: locations }] = await Promise.all([
    getGeographicZones(),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('role', 'resp_audiologie')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div>
      <Header
        title="Paramètres"
        description="Configuration générale de l'application"
      />
      <div className="p-6 space-y-8">
        <CompanyBrandingEditor />
        <ZoneConfigEditor zones={zones} />
        <PlannerAttributionEditor
          planners={(planners ?? []) as Pick<import('@/lib/types').Profile, 'id' | 'first_name' | 'last_name' | 'role'>[]}
          locations={(locations ?? []) as Pick<import('@/lib/types').Location, 'id' | 'name'>[]}
        />
        <ScouterDemo />
        <ChartColorsEditor />
      </div>
    </div>
  )
}
