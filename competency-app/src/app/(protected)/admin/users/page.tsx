import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { UserManagement } from '@/components/users/user-management'

export default async function UsersPage() {
  const supabase = await createClient()

  // Fetch users
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch locations
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch managers (users avec un role qui peut être manager d'autres profils).
  // Inclut 'gerant_franchise' depuis 00029 — un gérant franchise gère ses
  // salariés via manager_id, pareil qu'un manager succursale gère ses workers.
  const { data: managers } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['manager', 'super_admin', 'gerant_franchise'])
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  // Fetch job profiles : pilotent la grille de competences. Le champ Emploi
  // dans la modale d'edition est un Select sur ces profils metiers ; la
  // selection set job_profile_id (FK -> grille) ET job_title (texte affiche).
  const { data: jobProfiles } = await supabase
    .from('job_profiles')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  // Fetch toutes les affectations centre <-> gerant (N-a-N). On en derive
  // un mapping location_id -> list de gerants pour afficher TOUS les
  // gerants d'un centre dans la colonne Manager (un centre peut avoir
  // plusieurs co-gerants depuis migration 00031).
  const { data: centreManagersRows } = await supabase
    .from('centre_managers')
    .select('location_id, manager:profiles!manager_id(id, first_name, last_name)')

  const managersByLocation: Record<string, Array<{ id: string; name: string }>> = {}
  type CMRow = { location_id: string; manager: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null }
  for (const row of (centreManagersRows ?? []) as CMRow[]) {
    const mgr = Array.isArray(row.manager) ? row.manager[0] : row.manager
    if (!mgr) continue
    if (!managersByLocation[row.location_id]) managersByLocation[row.location_id] = []
    managersByLocation[row.location_id].push({
      id: mgr.id,
      name: `${mgr.first_name} ${mgr.last_name}`,
    })
  }

  return (
    <div>
      <Header
        title="Gestion des utilisateurs"
        description="Gerer les comptes, roles et equipes"
      />
      <div className="p-6">
        <UserManagement
          users={users ?? []}
          locations={locations ?? []}
          managers={managers ?? []}
          jobProfiles={jobProfiles ?? []}
          managersByLocation={managersByLocation}
        />
      </div>
    </div>
  )
}
