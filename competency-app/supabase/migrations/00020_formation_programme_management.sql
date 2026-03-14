-- ============================================
-- Migration 00020: Formation Programme Management
-- Upload files per (session, type), capacity per (session, type, programme),
-- room assignment, and registration toggle.
-- ============================================

-- 1. Programme files: one uploaded document per (session_id, type)
CREATE TABLE public.formation_programme_files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.formation_sessions(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('Audio', 'Assistante')),
  file_url   TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, type)
);

CREATE INDEX idx_fpf_session ON public.formation_programme_files(session_id);

CREATE TRIGGER fpf_updated_at BEFORE UPDATE ON public.formation_programme_files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Programme settings: capacity + room per (session_id, type, programme)
CREATE TABLE public.formation_programme_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.formation_sessions(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('Audio', 'Assistante')),
  programme  TEXT NOT NULL,
  max_places INTEGER NOT NULL DEFAULT 0,
  salle      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, type, programme)
);

CREATE INDEX idx_fps_session ON public.formation_programme_settings(session_id);
CREATE INDEX idx_fps_lookup ON public.formation_programme_settings(session_id, type, programme);

CREATE TRIGGER fps_updated_at BEFORE UPDATE ON public.formation_programme_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Add registration toggle to formation_sessions
ALTER TABLE public.formation_sessions
  ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- RLS Policies
-- ============================================

-- formation_programme_files
ALTER TABLE public.formation_programme_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpf_select" ON public.formation_programme_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fpf_manage" ON public.formation_programme_files
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));

-- formation_programme_settings
ALTER TABLE public.formation_programme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fps_select" ON public.formation_programme_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fps_manage" ON public.formation_programme_settings
  FOR ALL TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'))
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master', 'manager'));
