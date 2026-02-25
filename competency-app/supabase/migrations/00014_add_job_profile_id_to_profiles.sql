-- Migration 00014: Add job_profile_id FK to profiles table
-- Links workers to their job profile properly (instead of just a text job_title)

-- 1. Add the FK column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_profile_id UUID REFERENCES public.job_profiles(id) ON DELETE SET NULL;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_job_profile ON public.profiles(job_profile_id);

-- 3. Backfill from existing job_title text (case-insensitive, trimmed match)
UPDATE public.profiles p
SET job_profile_id = jp.id
FROM public.job_profiles jp
WHERE p.job_title IS NOT NULL
  AND p.job_title != ''
  AND LOWER(TRIM(p.job_title)) = LOWER(TRIM(jp.name))
  AND p.job_profile_id IS NULL;
