-- Migration 00015: Multi job profiles per worker (N-N)
-- Uses the existing audioprothesiste_assignments table as junction table

-- 1. Backfill audioprothesiste_assignments from profiles.job_profile_id
INSERT INTO public.audioprothesiste_assignments (audioprothesiste_id, job_profile_id)
SELECT id, job_profile_id
FROM public.profiles
WHERE job_profile_id IS NOT NULL
ON CONFLICT (audioprothesiste_id, job_profile_id) DO NOTHING;

-- 2. Remove the single job_profile_id FK from profiles (junction table is now the source of truth)
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS job_profile_id;
