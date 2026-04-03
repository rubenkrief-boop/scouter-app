import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { Header } from '@/components/layout/header'
import { getVisits } from '@/lib/actions/visits'
import { getGeographicZones } from '@/lib/actions/geographic-zones'
import { VisitListView } from '@/components/visits/visit-list-view'

export default async function VisitsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')

  const allowedRoles = ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'worker']
  if (!allowedRoles.includes(profile.role)) redirect('/dashboard')

  const [visits, zones] = await Promise.all([
    getVisits(),
    getGeographicZones(),
  ])

  // Get unique locations from visits for filter
  const locations = Array.from(
    new Map(
      visits
        .filter(v => v.location)
        .map(v => [v.location!.id, { id: v.location!.id, name: v.location!.name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const canPlan = ['super_admin', 'skill_master', 'manager', 'resp_audiologie'].includes(profile.role)

  return (
    <div>
      <Header
        title="Visites"
        description="Planification et suivi des deplacements en centres"
      />
      <div className="p-6">
        <VisitListView
          visits={visits}
          zones={zones}
          locations={locations}
          canPlan={canPlan}
          userRole={profile.role}
        />
      </div>
    </div>
  )
}
