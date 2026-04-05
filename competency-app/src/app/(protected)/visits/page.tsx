import { redirect } from 'next/navigation'
import { getAuthProfile } from '@/lib/supabase/auth-cache'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { getVisits, getPlannerLocations } from '@/lib/actions/visits'
import { getGeographicZones } from '@/lib/actions/geographic-zones'
import { VisitListView } from '@/components/visits/visit-list-view'
import { VisitCalendarFresco } from '@/components/visits/visit-calendar-fresco'

export default async function VisitsPage() {
  const { user, profile } = await getAuthProfile()
  if (!user || !profile) redirect('/auth/login')

  const allowedRoles = ['super_admin', 'skill_master', 'manager', 'resp_audiologie', 'worker']
  if (!allowedRoles.includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const [visits, zones, { data: allLocations }, myLocationIds] = await Promise.all([
    getVisits(),
    getGeographicZones(),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    getPlannerLocations(user.id),
  ])

  const locations = (allLocations ?? []).map(l => ({ id: l.id, name: l.name }))
  const canPlan = ['super_admin', 'skill_master', 'manager', 'resp_audiologie'].includes(profile.role)

  return (
    <div>
      <Header
        title="Visites"
        description="Planification et suivi des deplacements en centres"
      />
      <div className="p-6 space-y-6">
        <VisitCalendarFresco
          visits={visits}
          userRole={profile.role}
          myLocationIds={myLocationIds}
        />
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
