-- ============================================
-- Migration 00004: Fix missing manager role, locations table, and profile columns
-- ============================================

-- 1. Add 'manager' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager' AFTER 'skill_master';

-- 2. Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_active ON public.locations(is_active);

-- Trigger for updated_at
CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select" ON public.locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_insert" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('super_admin'));
CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('super_admin'));
CREATE POLICY "locations_delete" ON public.locations
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('super_admin'));

-- 3. Add missing columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_manager ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location_id);

-- 4. Update evaluations policies to include 'manager' role
DROP POLICY IF EXISTS "evaluations_insert" ON public.evaluations;
CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

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

-- 5. Update evaluation_results policies to include 'manager'
DROP POLICY IF EXISTS "eval_results_insert" ON public.evaluation_results;
CREATE POLICY "eval_results_insert" ON public.evaluation_results
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "eval_results_update" ON public.evaluation_results;
CREATE POLICY "eval_results_update" ON public.evaluation_results
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "eval_results_delete" ON public.evaluation_results;
CREATE POLICY "eval_results_delete" ON public.evaluation_results
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

-- 6. Update evaluation_result_qualifiers policies to include 'manager'
DROP POLICY IF EXISTS "erq_insert" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_insert" ON public.evaluation_result_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "erq_update" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_update" ON public.evaluation_result_qualifiers
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

DROP POLICY IF EXISTS "erq_delete" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_delete" ON public.evaluation_result_qualifiers
  FOR DELETE TO authenticated
  USING (public.get_user_role() IN ('evaluator', 'manager', 'super_admin'));

-- 7. Recreate handle_new_user to be safe (upsert instead of insert)
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

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
