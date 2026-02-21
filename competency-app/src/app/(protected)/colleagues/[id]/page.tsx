import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Mail, Briefcase, BarChart3 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { CompetencyRadarChart } from '@/components/charts/radar-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getColleagueProfile } from '@/lib/actions/colleagues'
import { getChartColors } from '@/lib/utils-app/chart-colors'

export default async function ColleagueProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { user, profile: currentProfile } = await getAuthProfile()

  if (!user || !currentProfile) redirect('/auth/login')

  // Seuls les workers accedent a cette page
  if (currentProfile.role !== 'worker') {
    redirect('/dashboard')
  }

  const data = await getColleagueProfile(id)
  if (!data) notFound()

  const { profile, radarData, evalCount, jobProfileName } = data
  const chartColors = await getChartColors()
  const fullName = `${profile.first_name} ${profile.last_name}`

  const avgScore = radarData.length > 0
    ? Math.round(radarData.reduce((sum, d) => sum + d.actual, 0) / radarData.length)
    : 0
  const modulesAboveExpected = radarData.filter(d => d.actual >= d.expected && d.expected > 0).length
  const modulesWithExpected = radarData.filter(d => d.expected > 0).length

  return (
    <div>
      <Header
        title={fullName}
        description="Bilan de compétences"
      />
      <div className="p-6 space-y-6">
        {/* Back link */}
        <Link
          href="/colleagues"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux collègues
        </Link>

        {/* Profile header card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{fullName}</h2>
                <p className="text-white/80">{profile.email}</p>
                {jobProfileName && (
                  <Badge className="mt-1.5 bg-white/20 text-white border-white/30 hover:bg-white/30">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {jobProfileName}
                  </Badge>
                )}
              </div>
            </div>

            {/* Info row */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-white/70">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {profile.email}
              </span>
              {profile.location_name && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {profile.location_name}
                </span>
              )}
            </div>
          </div>

          {/* Stats row */}
          <CardContent className="p-0">
            <div className="grid grid-cols-3 divide-x">
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{evalCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Évaluations</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600">{avgScore}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Score moyen</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {modulesAboveExpected}/{modulesWithExpected}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Modules validés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Radar chart - lecture seule, pas de detail par competence */}
        {radarData.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <div>
                <CardTitle className="text-lg font-semibold">Bilan de compétences</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Niveau actuel par module
                  {jobProfileName ? ` — Profil « ${jobProfileName} »` : ''}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <CompetencyRadarChart
                data={radarData}
                expectedLabel="Attendu"
                actualLabel="Niveau actuel"
                colors={chartColors}
                fullSize
              />
              {/* Code legend */}
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
                  {radarData.map((d, i) => {
                    const parts = d.module.split(' - ')
                    const code = parts[0]?.trim() || ''
                    const name = parts[1]?.trim() || d.module
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 w-6">{code}</span>
                        <span className="truncate">{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Module bars - seulement les % par module, pas de detail competences */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Progression par module</h3>
                {[...radarData]
                  .sort((a, b) => b.actual - a.actual)
                  .map((d, i) => {
                    const parts = d.module.split(' - ')
                    const name = parts[1]?.trim() || d.module
                    const pct = Math.round(d.actual)
                    const isGood = d.expected > 0 ? d.actual >= d.expected : true
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{name}</span>
                          <span className={`text-sm font-bold tabular-nums ${
                            isGood ? 'text-emerald-600' : pct >= d.expected * 0.7 ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          {d.expected > 0 && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"
                              style={{ left: `${Math.min(d.expected, 100)}%` }}
                            />
                          )}
                          <div
                            className={`absolute top-0 bottom-0 left-0 rounded-full transition-all duration-500 ${
                              isGood ? 'bg-emerald-500' : pct >= d.expected * 0.7 ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium text-muted-foreground">Aucune évaluation terminée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ce collègue n&apos;a pas encore été évalué.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
