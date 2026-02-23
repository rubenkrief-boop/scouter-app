import { Header } from '@/components/layout/header'
import { ChartColorsEditor } from '@/components/settings/chart-colors-editor'
import { ScouterDemo } from '@/components/settings/scouter-demo'

export default function SettingsPage() {
  return (
    <div>
      <Header
        title="Paramètres"
        description="Configuration générale de l'application"
      />
      <div className="p-6 space-y-8">
        <ScouterDemo />
        <ChartColorsEditor />
      </div>
    </div>
  )
}
