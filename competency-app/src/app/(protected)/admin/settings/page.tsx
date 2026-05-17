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
    // Planners potentiels : super_admin, manager, resp_audiologie (les
    // memes roles autorises cote server actions PLANNER_ROLES dans
    // src/lib/actions/visits.ts). Les managers Sacha/Pierre-Ugo peuvent
    // ainsi etre affectes a leurs centres a visiter.
    supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('role', ['super_admin', 'manager', 'resp_audiologie'])
      .eq('is_active', true)
      .order('last_name'),
    // Centres franchise (prefixe F-) exclus : pas de visites de
    // supervision Vivason sur les franchises, donc pas d'attribution
    // planner non plus.
    supabase
      .from('locations')
      .select('id, name')
      .eq('is_active', true)
      .not('name', 'ilike', 'F-%')
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
