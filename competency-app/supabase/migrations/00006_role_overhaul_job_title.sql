-- ============================================
-- Migration 00006: Role overhaul + job_title
-- - Remove evaluator role (migrate to skill_master)
-- - Rename audioprothesiste to worker
-- - Add job_title column to profiles
-- - Update all RLS policies
-- ============================================

-- 1. Add 'worker' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'worker';

-- 2. Add job_title column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- 3. Migrate existing data
-- Audioprothesiste -> worker (preserve job info)
UPDATE public.profiles
SET role = 'worker', job_title = 'Audioprothésiste'
WHERE role = 'audioprothesiste';

-- Evaluator -> skill_master
UPDATE public.profiles
SET role = 'skill_master'
WHERE role = 'evaluator';

-- 4. Update handle_new_user() trigger: default to 'worker'
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
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'worker'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.profiles.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update evaluations policies: replace 'evaluator' with 'skill_master'
DROP POLICY IF EXISTS "evaluations_insert" ON public.evaluations;
CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "evaluations_select" ON public.evaluations;
CREATE POLICY "evaluations_select" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR audioprothesiste_id = auth.uid()
    OR public.get_user_role() IN ('super_admin', 'skill_master', 'manager')
  );

DROP POLICY IF EXISTS "evaluations_update" ON public.evaluations;
CREATE POLICY "evaluations_update" ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.get_user_role() IN ('super_admin', 'manager')
  );

-- 6. Update evaluation_results policies
DROP POLICY IF EXISTS "eval_results_insert" ON public.evaluation_results;
CREATE POLICY "eval_results_insert" ON public.evaluation_results
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "eval_results_update" ON public.evaluation_results;
CREATE POLICY "eval_results_update" ON public.evaluation_results
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "eval_results_delete" ON public.evaluation_results;
CREATE POLICY "eval_results_delete" ON public.evaluation_results
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

-- 7. Update evaluation_result_qualifiers policies
DROP POLICY IF EXISTS "erq_insert" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_insert" ON public.evaluation_result_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "erq_update" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_update" ON public.evaluation_result_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "erq_delete" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_delete" ON public.evaluation_result_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('skill_master', 'manager', 'super_admin'));

-- 8. Update evaluation_comments insert policy
DROP POLICY IF EXISTS "eval_comments_insert" ON public.evaluation_comments;
CREATE POLICY "eval_comments_insert" ON public.evaluation_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_user_role() IN ('skill_master', 'manager', 'super_admin')
  );
