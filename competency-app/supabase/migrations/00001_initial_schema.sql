-- ============================================
-- CompétencesPro - Initial Database Schema
-- ============================================

-- Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'skill_master', 'evaluator', 'audioprothesiste');
CREATE TYPE qualifier_type AS ENUM ('single_choice', 'multiple_choice');

-- ============================================
-- Table: profiles (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'audioprothesiste',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_active ON public.profiles(is_active);

-- ============================================
-- Table: modules (hierarchical)
-- ============================================
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_modules_parent ON public.modules(parent_id);
CREATE INDEX idx_modules_sort ON public.modules(sort_order);

-- ============================================
-- Table: competencies
-- ============================================
CREATE TABLE public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  external_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_competencies_module ON public.competencies(module_id);

-- ============================================
-- Table: qualifiers
-- ============================================
CREATE TABLE public.qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  qualifier_type qualifier_type NOT NULL DEFAULT 'single_choice',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Table: qualifier_options
-- ============================================
CREATE TABLE public.qualifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualifier_id UUID NOT NULL REFERENCES public.qualifiers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qualifier_options_qualifier ON public.qualifier_options(qualifier_id);

-- ============================================
-- Table: job_profiles
-- ============================================
CREATE TABLE public.job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Table: job_profile_competencies
-- ============================================
CREATE TABLE public.job_profile_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_profile_id UUID NOT NULL REFERENCES public.job_profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  expected_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_profile_id, module_id)
);

CREATE INDEX idx_jpc_profile ON public.job_profile_competencies(job_profile_id);

-- ============================================
-- Table: evaluations
-- ============================================
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluator_id UUID NOT NULL REFERENCES public.profiles(id),
  audioprothesiste_id UUID NOT NULL REFERENCES public.profiles(id),
  job_profile_id UUID REFERENCES public.job_profiles(id),
  title TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX idx_evaluations_audio ON public.evaluations(audioprothesiste_id);
CREATE INDEX idx_evaluations_status ON public.evaluations(status);

-- ============================================
-- Table: evaluation_results
-- ============================================
CREATE TABLE public.evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES public.competencies(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, competency_id)
);

CREATE INDEX idx_eval_results_evaluation ON public.evaluation_results(evaluation_id);

-- ============================================
-- Table: evaluation_result_qualifiers
-- ============================================
CREATE TABLE public.evaluation_result_qualifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_result_id UUID NOT NULL REFERENCES public.evaluation_results(id) ON DELETE CASCADE,
  qualifier_id UUID NOT NULL REFERENCES public.qualifiers(id),
  qualifier_option_id UUID NOT NULL REFERENCES public.qualifier_options(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_result_id, qualifier_id)
);

CREATE INDEX idx_erq_result ON public.evaluation_result_qualifiers(evaluation_result_id);

-- ============================================
-- Table: audioprothesiste_assignments
-- ============================================
CREATE TABLE public.audioprothesiste_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audioprothesiste_id UUID NOT NULL REFERENCES public.profiles(id),
  job_profile_id UUID NOT NULL REFERENCES public.job_profiles(id),
  assigned_evaluator_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(audioprothesiste_id, job_profile_id)
);

-- ============================================
-- Functions
-- ============================================

-- Get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Get module scores for an evaluation
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
BEGIN
  RETURN QUERY
  SELECT
    m.id AS module_id,
    m.code AS module_code,
    m.name AS module_name,
    COALESCE(SUM(qo.value), 0) AS actual_score,
    CASE
      WHEN COUNT(DISTINCT erq.id) = 0 THEN COUNT(DISTINCT c.id) * 1.0
      ELSE COUNT(DISTINCT erq.id) * 1.0
    END AS total_possible,
    CASE
      WHEN COUNT(DISTINCT c.id) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(qo.value), 0) / GREATEST(COUNT(DISTINCT erq.id) * 1.0, 1)) * 100,
        1
      )
    END AS completion_pct
  FROM public.modules m
  JOIN public.competencies c ON c.module_id = m.id
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

-- Get recursive module tree
CREATE OR REPLACE FUNCTION public.get_module_tree()
RETURNS TABLE(
  id UUID,
  parent_id UUID,
  code TEXT,
  name TEXT,
  depth INTEGER,
  path TEXT
)
LANGUAGE SQL SECURITY DEFINER AS $$
  WITH RECURSIVE module_tree AS (
    SELECT m.id, m.parent_id, m.code, m.name, 0 AS depth,
           m.code AS path
    FROM public.modules m
    WHERE m.parent_id IS NULL AND m.is_active = true
    UNION ALL
    SELECT m.id, m.parent_id, m.code, m.name, mt.depth + 1,
           mt.path || '.' || m.code
    FROM public.modules m
    JOIN module_tree mt ON m.parent_id = mt.id
    WHERE m.is_active = true
  )
  SELECT * FROM module_tree ORDER BY path;
$$;

-- ============================================
-- Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER modules_updated_at BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER competencies_updated_at BEFORE UPDATE ON public.competencies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER qualifiers_updated_at BEFORE UPDATE ON public.qualifiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER evaluations_updated_at BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER evaluation_results_updated_at BEFORE UPDATE ON public.evaluation_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER job_profiles_updated_at BEFORE UPDATE ON public.job_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup (supports Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'given_name',
      NEW.raw_user_meta_data->>'first_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email), ' ', 1),
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'family_name',
      NEW.raw_user_meta_data->>'last_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ' ', 2),
      ''
    ),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'audioprothesiste'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qualifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_profile_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_result_qualifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audioprothesiste_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- Modules: readable by all, writable by skill_master + super_admin
CREATE POLICY "modules_select" ON public.modules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules_insert" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "modules_update" ON public.modules
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "modules_delete" ON public.modules
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Competencies: same as modules
CREATE POLICY "competencies_select" ON public.competencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "competencies_insert" ON public.competencies
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "competencies_update" ON public.competencies
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "competencies_delete" ON public.competencies
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Qualifiers: same as modules
CREATE POLICY "qualifiers_select" ON public.qualifiers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "qualifiers_insert" ON public.qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "qualifiers_update" ON public.qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "qualifiers_delete" ON public.qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Qualifier options: same as qualifiers
CREATE POLICY "qualifier_options_select" ON public.qualifier_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "qualifier_options_insert" ON public.qualifier_options
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "qualifier_options_update" ON public.qualifier_options
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "qualifier_options_delete" ON public.qualifier_options
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Job profiles: same as modules
CREATE POLICY "job_profiles_select" ON public.job_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_profiles_insert" ON public.job_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "job_profiles_update" ON public.job_profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "job_profiles_delete" ON public.job_profiles
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Job profile competencies
CREATE POLICY "jpc_select" ON public.job_profile_competencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "jpc_insert" ON public.job_profile_competencies
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpc_update" ON public.job_profile_competencies
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));
CREATE POLICY "jpc_delete" ON public.job_profile_competencies
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'super_admin'));

-- Evaluations: evaluator sees own, audioprothesiste sees own, admin sees all
CREATE POLICY "evaluations_select" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR audioprothesiste_id = auth.uid()
    OR public.get_user_role() IN ('super_admin', 'skill_master')
  );
CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'super_admin'));
CREATE POLICY "evaluations_update" ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.get_user_role() = 'super_admin'
  );
CREATE POLICY "evaluations_delete" ON public.evaluations
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- Evaluation results
CREATE POLICY "eval_results_select" ON public.evaluation_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_results_insert" ON public.evaluation_results
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'super_admin'));
CREATE POLICY "eval_results_update" ON public.evaluation_results
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'super_admin'));
CREATE POLICY "eval_results_delete" ON public.evaluation_results
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'super_admin'));

-- Evaluation result qualifiers
CREATE POLICY "erq_select" ON public.evaluation_result_qualifiers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "erq_insert" ON public.evaluation_result_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'super_admin'));
CREATE POLICY "erq_update" ON public.evaluation_result_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'super_admin'));
CREATE POLICY "erq_delete" ON public.evaluation_result_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'super_admin'));

-- Audioprothesiste assignments
CREATE POLICY "assignments_select" ON public.audioprothesiste_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments_insert" ON public.audioprothesiste_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin', 'skill_master'));
CREATE POLICY "assignments_update" ON public.audioprothesiste_assignments
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master'));
CREATE POLICY "assignments_delete" ON public.audioprothesiste_assignments
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('super_admin', 'skill_master'));
