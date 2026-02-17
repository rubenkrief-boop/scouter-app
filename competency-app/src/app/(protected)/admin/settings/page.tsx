import { Header } from '@/components/layout/header'
import { ChartColorsEditor } from '@/components/settings/chart-colors-editor'

export default function SettingsPage() {
  return (
    <div>
      <Header
        title="Paramètres"
        description="Configuration générale de l'application"
      />
      <div className="p-6 space-y-8">
        <ChartColorsEditor />
      </div>
    </div>
  )
}
