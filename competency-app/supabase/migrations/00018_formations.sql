-- ============================================
-- Migration 00018: Formations Plénières
-- Suivi des sessions de formation, ateliers, inscriptions et programmes
-- ============================================

-- Sessions de formation (plénières semestrielles)
CREATE TABLE public.formation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  date_info TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_formation_sessions_code ON public.formation_sessions(code);
CREATE INDEX idx_formation_sessions_sort ON public.formation_sessions(sort_order);

CREATE TRIGGER formation_sessions_updated_at BEFORE UPDATE ON public.formation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Ateliers (workshops) par session et type
CREATE TABLE public.formation_ateliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.formation_sessions(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  formateur TEXT,
  duree TEXT,
  type TEXT NOT NULL CHECK (type IN ('Audio', 'Assistante')),
  etat TEXT NOT NULL DEFAULT 'Pas commencé' CHECK (etat IN ('Terminé', 'En cours', 'Pas commencé')),
  programmes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_formation_ateliers_session ON public.formation_ateliers(session_id);
CREATE INDEX idx_formation_ateliers_type ON public.formation_ateliers(type);

CREATE TRIGGER formation_ateliers_updated_at BEFORE UPDATE ON public.formation_ateliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Inscriptions de participants
CREATE TABLE public.formation_inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.formation_sessions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Audio', 'Assistante')),
  statut TEXT NOT NULL CHECK (statut IN ('Succursale', 'Franchise')),
  programme TEXT NOT NULL,
  centre TEXT,
  dpc BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, nom, prenom, type)
);

CREATE INDEX idx_formation_inscriptions_session ON public.formation_inscriptions(session_id);
CREATE INDEX idx_formation_inscriptions_profile ON public.formation_inscriptions(profile_id);
CREATE INDEX idx_formation_inscriptions_type ON public.formation_inscriptions(type);

CREATE TRIGGER formation_inscriptions_updated_at BEFORE UPDATE ON public.formation_inscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Mapping programme → ateliers par session et type
CREATE TABLE public.formation_programme_ateliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.formation_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('Audio', 'Assistante')),
  programme TEXT NOT NULL,
  atelier_id UUID NOT NULL REFERENCES public.formation_ateliers(id) ON DELETE CASCADE,
  UNIQUE(session_id, type, programme, atelier_id)
);

CREATE INDEX idx_formation_prog_ateliers_session ON public.formation_programme_ateliers(session_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.formation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_ateliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_inscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formation_programme_ateliers ENABLE ROW LEVEL SECURITY;

-- SELECT: tous les authentifiés peuvent lire
CREATE POLICY "formation_sessions_select" ON public.formation_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "formation_ateliers_select" ON public.formation_ateliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "formation_inscriptions_select" ON public.formation_inscriptions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "formation_programme_ateliers_select" ON public.formation_programme_ateliers
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: admin, skill_master, manager uniquement
CREATE POLICY "formation_sessions_manage" ON public.formation_sessions
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));

CREATE POLICY "formation_ateliers_manage" ON public.formation_ateliers
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));

CREATE POLICY "formation_inscriptions_manage" ON public.formation_inscriptions
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));

CREATE POLICY "formation_programme_ateliers_manage" ON public.formation_programme_ateliers
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));
