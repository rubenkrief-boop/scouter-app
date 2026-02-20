-- ============================================
-- Link qualifiers to job profiles
-- Allows each job profile to use a specific set of qualifiers
-- If no qualifiers are linked, all active qualifiers are used (backward compatible)
-- ============================================

CREATE TABLE public.job_profile_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_profile_id UUID NOT NULL REFERENCES public.job_profiles(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES public.qualifiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_profile_id, qualifier_id)
);

CREATE INDEX idx_jpq_profile ON public.job_profile_qualifiers(job_profile_id);

ALTER TABLE public.job_profile_qualifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jpq_select" ON public.job_profile_qualifiers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "jpq_insert" ON public.job_profile_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpq_update" ON public.job_profile_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpq_delete" ON public.job_profile_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE TRIGGER job_profile_qualifiers_updated_at BEFORE UPDATE ON public.job_profile_qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
