import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getGlobalStatistics, getProgressionData, getGapAnalysis } from '@/lib/actions/statistics'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { StatisticsDashboard } from '@/components/statistics/statistics-dashboard'
import { VisitStats } from '@/components/visits/visit-stats'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getVisits } from '@/lib/actions/visits'

export default async function StatisticsPage() {
  const { user, profile } = await getAuthProfile()

  if (!user || !profile) redirect('/auth/login')

  // Accessible aux super_admin, skill_master et manager uniquement
  const allowedRoles = ['super_admin', 'skill_master', 'manager', 'resp_audiologie']
  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard')
  }

  // Fetch all data in parallel
  const [{ userSummaries }, chartColors, progressionData, gapAnalysis, visits] = await Promise.all([
    getGlobalStatistics(),
    getChartColors(),
    getProgressionData(),
    getGapAnalysis(),
    getVisits(),
  ])

  return (
    <div>
      <Header
        title="Statistiques"
        description="Vue d'ensemble des performances de tous les collaborateurs"
      />
      <div className="p-6">
        <StatisticsDashboard
          userSummaries={userSummaries}
          chartColors={chartColors}
          progressionData={progressionData}
          gapAnalysis={gapAnalysis}
        />

        {/* Visit Statistics */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Suivi des deplacements</h2>
          <VisitStats visits={visits} />
        </div>
      </div>
    </div>
  )
}
