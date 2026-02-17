-- ============================================
-- Migration: Competency Weighting System
-- Adds per-competency weight and expected_score
-- ============================================

-- New table: per-competency settings within a job profile
CREATE TABLE public.job_profile_competency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_profile_id UUID NOT NULL REFERENCES public.job_profiles(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  weight NUMERIC NOT NULL DEFAULT 1,
  expected_score NUMERIC NOT NULL DEFAULT 70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_profile_id, competency_id)
);

CREATE INDEX idx_jpcs_profile ON public.job_profile_competency_settings(job_profile_id);
CREATE INDEX idx_jpcs_competency ON public.job_profile_competency_settings(competency_id);

-- RLS for job_profile_competency_settings
ALTER TABLE public.job_profile_competency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jpcs_select" ON public.job_profile_competency_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "jpcs_insert" ON public.job_profile_competency_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpcs_update" ON public.job_profile_competency_settings
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpcs_delete" ON public.job_profile_competency_settings
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_jpcs_updated_at
  BEFORE UPDATE ON public.job_profile_competency_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- Update get_module_scores to use weighted scoring
-- ============================================
CREATE OR REPLACE FUNCTION public.get_module_scores(p_evaluation_id UUID)
RETURNS TABLE(
  module_id UUID,
  module_code TEXT,
  module_name TEXT,
  actual_score NUMERIC,
  total_possible NUMERIC,
  completion_pct NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job_profile_id UUID;
BEGIN
  -- Get the job profile for this evaluation
  SELECT e.job_profile_id INTO v_job_profile_id
  FROM public.evaluations e
  WHERE e.id = p_evaluation_id;

  RETURN QUERY
  SELECT
    m.id AS module_id,
    m.code AS module_code,
    m.name AS module_name,
    -- Weighted actual score: sum of (qualifier_value * competency_weight)
    COALESCE(SUM(
      qo.value * COALESCE(jpcs.weight, 1)
    ), 0) AS actual_score,
    -- Weighted total possible: sum of (max_qualifier_value * competency_weight * num_qualifiers_answered)
    CASE
      WHEN COUNT(DISTINCT erq.id) = 0 THEN COUNT(DISTINCT c.id) * 1.0
      ELSE SUM(
        CASE WHEN erq.id IS NOT NULL THEN COALESCE(jpcs.weight, 1) ELSE 0 END
      )
    END AS total_possible,
    -- Completion percentage
    CASE
      WHEN COUNT(DISTINCT c.id) = 0 THEN 0
      ELSE ROUND(
        (
          COALESCE(SUM(qo.value * COALESCE(jpcs.weight, 1)), 0)
          /
          GREATEST(
            SUM(CASE WHEN erq.id IS NOT NULL THEN COALESCE(jpcs.weight, 1) ELSE 0 END),
            1
          )
        ) * 100,
        1
      )
    END AS completion_pct
  FROM public.modules m
  JOIN public.competencies c ON c.module_id = m.id
  LEFT JOIN public.job_profile_competency_settings jpcs
    ON jpcs.competency_id = c.id AND jpcs.job_profile_id = v_job_profile_id
  LEFT JOIN public.evaluation_results er
    ON er.competency_id = c.id AND er.evaluation_id = p_evaluation_id
  LEFT JOIN public.evaluation_result_qualifiers erq
    ON erq.evaluation_result_id = er.id
  LEFT JOIN public.qualifier_options qo
    ON qo.id = erq.qualifier_option_id
  WHERE m.parent_id IS NULL AND m.is_active = true
  GROUP BY m.id, m.code, m.name
  ORDER BY m.sort_order;
END;
$$;
