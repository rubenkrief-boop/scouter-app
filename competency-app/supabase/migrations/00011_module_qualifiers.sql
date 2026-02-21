-- Migration: module_qualifiers
-- Attribution des qualifiers par module (au lieu de globalement)

CREATE TABLE public.module_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES public.qualifiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, qualifier_id)
);

CREATE INDEX idx_module_qualifiers_module ON public.module_qualifiers(module_id);
CREATE INDEX idx_module_qualifiers_qualifier ON public.module_qualifiers(qualifier_id);

ALTER TABLE public.module_qualifiers ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifies
CREATE POLICY "module_qualifiers_select" ON public.module_qualifiers
  FOR SELECT TO authenticated USING (true);

-- Ecriture pour skill_master et super_admin uniquement
CREATE POLICY "module_qualifiers_insert" ON public.module_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE POLICY "module_qualifiers_update" ON public.module_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE POLICY "module_qualifiers_delete" ON public.module_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Trigger updated_at
CREATE TRIGGER module_qualifiers_updated_at
  BEFORE UPDATE ON public.module_qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
