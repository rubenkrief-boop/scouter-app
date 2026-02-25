-- Migration: competency_qualifiers
-- Attribution optionnelle de qualifiers specifiques par competence
-- (override du qualifier global du module)

CREATE TABLE public.competency_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES public.qualifiers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(competency_id, qualifier_id)
);

CREATE INDEX idx_competency_qualifiers_competency ON public.competency_qualifiers(competency_id);
CREATE INDEX idx_competency_qualifiers_qualifier ON public.competency_qualifiers(qualifier_id);

ALTER TABLE public.competency_qualifiers ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les utilisateurs authentifies
CREATE POLICY "competency_qualifiers_select" ON public.competency_qualifiers
  FOR SELECT TO authenticated USING (true);

-- Ecriture pour skill_master et super_admin uniquement
CREATE POLICY "competency_qualifiers_insert" ON public.competency_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE POLICY "competency_qualifiers_update" ON public.competency_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

CREATE POLICY "competency_qualifiers_delete" ON public.competency_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Trigger updated_at
CREATE TRIGGER competency_qualifiers_updated_at
  BEFORE UPDATE ON public.competency_qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
