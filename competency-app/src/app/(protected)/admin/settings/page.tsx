import { Header } from '@/components/layout/header'
import { ChartColorsEditor } from '@/components/settings/chart-colors-editor'
import { ScouterDemo } from '@/components/settings/scouter-demo'
import { CompanyBrandingEditor } from '@/components/settings/company-branding-editor'
import { ZoneConfigEditor } from '@/components/visits/zone-config-editor'
import { getGeographicZones } from '@/lib/actions/geographic-zones'

export default async function SettingsPage() {
  const zones = await getGeographicZones()

  return (
    <div>
      <Header
        title="Paramètres"
        description="Configuration générale de l'application"
      />
      <div className="p-6 space-y-8">
        <CompanyBrandingEditor />
        <ZoneConfigEditor zones={zones} />
        <ScouterDemo />
        <ChartColorsEditor />
      </div>
    </div>
  )
}
