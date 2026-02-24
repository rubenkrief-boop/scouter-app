import { Header } from '@/components/layout/header'
import { ChartColorsEditor } from '@/components/settings/chart-colors-editor'
import { ScouterDemo } from '@/components/settings/scouter-demo'
import { CompanyBrandingEditor } from '@/components/settings/company-branding-editor'

export default function SettingsPage() {
  return (
    <div>
      <Header
        title="Paramètres"
        description="Configuration générale de l'application"
      />
      <div className="p-6 space-y-8">
        <CompanyBrandingEditor />
        <ScouterDemo />
        <ChartColorsEditor />
      </div>
    </div>
  )
}
