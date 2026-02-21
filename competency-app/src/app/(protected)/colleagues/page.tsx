import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Search, Users, MapPin, BarChart3, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { getColleagues } from '@/lib/actions/colleagues'

export default async function ColleaguesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const { user, profile: currentProfile } = await getAuthProfile()

  if (!user || !currentProfile) redirect('/auth/login')

  // Seuls les workers accedent a cette page
  if (currentProfile.role !== 'worker') {
    redirect('/dashboard')
  }

  let colleagues = await getColleagues()

  // Filtre par recherche
  if (q) {
    const search = q.toLowerCase()
    colleagues = colleagues.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search)
    )
  }

  return (
    <div>
      <Header
        title="Collègues"
        description="Consultez le bilan de compétences de vos collègues"
      />
      <div className="p-6 space-y-6">
        {/* Search bar */}
        <form className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Rechercher par nom ou email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </form>

        {/* Results count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{colleagues.length} collègue{colleagues.length !== 1 ? 's' : ''}</span>
          {q && <Badge variant="secondary" className="text-xs">{q}</Badge>}
        </div>

        {/* Colleague cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {colleagues.map((c) => (
            <Link key={c.id} href={`/colleagues/${c.id}`}>
              <Card className="hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {c.first_name} {c.last_name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.email}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" />
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    {c.location_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.location_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {c.eval_count} éval{c.eval_count !== 1 ? 's' : ''}
                    </span>
                    {c.avg_score !== null && (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          c.avg_score >= 70
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : c.avg_score >= 40
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                        }`}
                      >
                        {c.avg_score}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {colleagues.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Aucun collègue trouvé</p>
            {q && <p className="text-sm mt-1">Essayez avec un autre terme de recherche</p>}
          </div>
        )}
      </div>
    </div>
  )
}
