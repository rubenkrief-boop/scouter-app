import { Header } from '@/components/layout/header'
import { getGlobalStatistics, getProgressionData, getGapAnalysis } from '@/lib/actions/statistics'
import { getChartColors } from '@/lib/utils-app/chart-colors'
import { StatisticsDashboard } from '@/components/statistics/statistics-dashboard'

export default async function StatisticsPage() {
  // Fetch all data in parallel
  const [{ moduleStats, userSummaries }, chartColors, progressionData, gapAnalysis] = await Promise.all([
    getGlobalStatistics(),
    getChartColors(),
    getProgressionData(),
    getGapAnalysis(),
  ])

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
          progressionData={progressionData}
          gapAnalysis={gapAnalysis}
        />
      </div>
    </div>
  )
}
