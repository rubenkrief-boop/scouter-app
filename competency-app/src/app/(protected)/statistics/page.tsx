import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getGlobalStatistics } from '@/lib/actions/statistics'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { StatisticsDashboard } from '@/components/statistics/statistics-dashboard'
import { getAuthProfile } from '@/lib/supabase/auth-cache'

export default async function StatisticsPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) redirect('/auth/login')

  // Accessible aux super_admin et manager uniquement
  const allowedRoles = ['super_admin', 'manager']
  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard')
  }

  const { moduleStats, userSummaries } = await getGlobalStatistics()
  const chartColors = await getChartColors()

  return (
    <div>
      <Header
        title="Statistiques"
        description="Vue d'ensemble des performances de tous les collaborateurs"
      />
      <div className="p-6">
        <StatisticsDashboard
          moduleStats={moduleStats}
          userSummaries={userSummaries}
          chartColors={chartColors}
        />
      </div>
    </div>
  )
}
