-- Migration 00031 : table de liaison N-a-N entre managers/gerants et centres.
--
-- Probleme resolu : aujourd'hui `profiles.manager_id` impose 1 seul manager
-- par salarie. Or :
--   - Un gerant franchise peut gerer plusieurs centres (ex: Quentin Pigne
--     -> Annecy + Bourg-en-Bresse + Bourgoin-Jaillieu + Chambery + Decines).
--   - Un centre peut avoir plusieurs co-gerants (ex: Annecy = Quentin Pigne
--     + Clementine Appel).
--   - Un manager succursale peut superviser des franchises (ex: Sacha
--     Binabout -> 10 succursales + 3 franchises Compiegne/Coulommiers/Creteil).
--
-- Cette table stocke la relation N-a-N. Elle remplace le role joue par
-- `profiles.manager_id` pour la gestion des inscriptions formation
-- (cf. getMyFranchiseTeam / enrollMyFranchiseTeam). Le `manager_id` reste
-- utilise pour le lien hierarchique 1-a-1 (workers succursale -> manager).

CREATE TABLE IF NOT EXISTS public.centre_managers (
  manager_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (manager_id, location_id)
);

-- Index pour la jointure cote "salaries d'un gerant"
CREATE INDEX IF NOT EXISTS centre_managers_manager_idx
  ON public.centre_managers(manager_id);

-- Index pour la jointure cote "gerants d'un centre"
CREATE INDEX IF NOT EXISTS centre_managers_location_idx
  ON public.centre_managers(location_id);

-- RLS : lecture autorisee a tous les utilisateurs authentifies (les
-- gerants ont besoin de voir leurs propres affectations, et les
-- composants UI cote admin/manager listent tout). Ecritures reservees
-- a super_admin via le helper is_super_admin().
ALTER TABLE public.centre_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centre_managers_read ON public.centre_managers;
CREATE POLICY centre_managers_read ON public.centre_managers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS centre_managers_admin_write ON public.centre_managers;
CREATE POLICY centre_managers_admin_write ON public.centre_managers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Helper SECURITY DEFINER pour eviter de cascader la RLS dans les
-- queries cote /formations (le gerant veut juste savoir "quels centres
-- je gere"). Search path pinned pour bloquer injection via recherche.
CREATE OR REPLACE FUNCTION public.my_managed_locations()
RETURNS TABLE(location_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT cm.location_id
  FROM public.centre_managers cm
  WHERE cm.manager_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_managed_locations() TO authenticated;
