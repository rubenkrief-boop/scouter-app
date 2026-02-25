import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, MapPin, BarChart3, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { WorkerFilters } from '@/components/workers/worker-filters'

export default async function WorkersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string }>
}) {
  const { q, location } = await searchParams
  const { user, profile: currentProfile } = await getAuthProfile()

  if (!user || !currentProfile) redirect('/auth/login')

  // Only managers, skill_masters, and super_admins can view workers
  const allowedRoles = ['super_admin', 'skill_master', 'manager']
  if (!allowedRoles.includes(currentProfile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Get all active locations for filter dropdown
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Get all active workers with their location
  let workersQuery = supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, job_title, role, avatar_url,
      location:locations(name),
      location_id
    `)
    .eq('role', 'worker')
    .eq('is_active', true)
    .order('last_name', { ascending: true })

  // Filter by location server-side
  if (location) {
    workersQuery = workersQuery.eq('location_id', location)
  }

  const { data: workers } = await workersQuery

  // Filter by search query
  let filteredWorkers = workers ?? []
  if (q) {
    const search = q.toLowerCase()
    filteredWorkers = filteredWorkers.filter(w =>
      `${w.first_name} ${w.last_name}`.toLowerCase().includes(search) ||
      w.email.toLowerCase().includes(search) ||
      w.job_title?.toLowerCase().includes(search)
    )
  }

  // Get eval count + latest score for each worker
  const workersWithStats = await Promise.all(
    filteredWorkers.map(async (w) => {
      const loc = w.location as any

      const { count } = await supabase
        .from('evaluations')
        .select('*', { count: 'exact', head: true })
        .eq('audioprothesiste_id', w.id)
        .eq('status', 'completed')

      let avgScore: number | null = null
      const { data: latestEval } = await supabase
        .from('evaluations')
        .select('id')
        .eq('audioprothesiste_id', w.id)
        .eq('status', 'completed')
        .order('evaluated_at', { ascending: false })
        .limit(1)
        .single()

      if (latestEval) {
        const { data: scores } = await supabase
          .rpc('get_module_scores', { p_evaluation_id: latestEval.id })
        if (scores && scores.length > 0) {
          const total = scores.reduce((sum: number, s: any) => sum + (parseFloat(s.completion_pct) || 0), 0)
          avgScore = Math.round(total / scores.length)
        }
      }

      return {
        ...w,
        location_name: loc?.name ?? null,
        eval_count: count ?? 0,
        avg_score: avgScore,
      }
    })
  )

  return (
    <div>
      <Header
        title="Collaborateurs"
        description="Recherchez un collaborateur et consultez son bilan de compétences"
      />
      <div className="p-6 space-y-6">
        {/* Filters: search + location */}
        <WorkerFilters
          locations={locations ?? []}
          currentQuery={q}
          currentLocation={location}
        />

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{workersWithStats.length} collaborateur{workersWithStats.length !== 1 ? 's' : ''}</span>
          {q && <Badge variant="secondary" className="text-xs">{q}</Badge>}
          {location && locations && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {locations.find(l => l.id === location)?.name ?? 'Centre'}
            </Badge>
          )}
        </div>

        {/* Worker cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workersWithStats.map((w) => (
            <Link key={w.id} href={`/workers/${w.id}`}>
              <Card className="hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0 overflow-hidden relative">
                        {(w as any).avatar_url ? (
                          <img
                            src={(w as any).avatar_url}
                            alt={`${w.first_name} ${w.last_name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>{w.first_name?.[0]}{w.last_name?.[0]}</>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {w.first_name} {w.last_name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {w.job_title ?? 'Poste non défini'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    {w.location_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {w.location_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {w.eval_count} éval{w.eval_count !== 1 ? 's' : ''}
                    </span>
                    {w.avg_score !== null && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          w.avg_score >= 70
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : w.avg_score >= 40
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                        }`}
                      >
                        {w.avg_score}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {workersWithStats.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun collaborateur trouvé</p>
            {q && <p className="text-sm mt-1">Essayez avec un autre terme de recherche</p>}
          </div>
        )}
      </div>
    </div>
  )
}
