-- ============================================
-- Module Visites / Déplacements
-- ============================================

-- 1. Enum statut visite
CREATE TYPE public.visit_status AS ENUM ('planned', 'completed', 'cancelled');

-- 2. Table zones géographiques
CREATE TABLE IF NOT EXISTS public.geographic_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  freq_days_manager INT NOT NULL DEFAULT 30,
  freq_days_resp INT NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#3B82F6',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Ajouter zone_id aux locations
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.geographic_zones(id) ON DELETE SET NULL;

-- 4. Table attributions planificateurs <-> centres
CREATE TABLE IF NOT EXISTS public.planner_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, location_id)
);

-- 5. Table visites
CREATE TABLE IF NOT EXISTS public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.visit_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_visits_location ON public.visits(location_id);
CREATE INDEX IF NOT EXISTS idx_visits_start_date ON public.visits(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_created_by ON public.visits(created_by);
CREATE INDEX IF NOT EXISTS idx_planner_locations_profile ON public.planner_locations(profile_id);
CREATE INDEX IF NOT EXISTS idx_planner_locations_location ON public.planner_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON public.locations(zone_id);

-- 7. Trigger updated_at
CREATE TRIGGER handle_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. RLS
ALTER TABLE public.geographic_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Zones: all authenticated can read, admin can write
CREATE POLICY "zones_read" ON public.geographic_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "zones_admin" ON public.geographic_zones FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Planner locations: admin manages, all can read
CREATE POLICY "planner_loc_read" ON public.planner_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "planner_loc_admin" ON public.planner_locations FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- Visits: role-based access
CREATE POLICY "visits_select" ON public.visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "visits_insert" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('super_admin', 'resp_audiologie', 'manager', 'skill_master')
    AND created_by = auth.uid()
  );
CREATE POLICY "visits_update" ON public.visits FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'super_admin'
    OR created_by = auth.uid()
  );
CREATE POLICY "visits_delete" ON public.visits FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');
