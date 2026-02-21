-- ============================================
-- Migration 00009: Deduplicate competencies
-- If seed was run multiple times, competencies got inserted multiple times.
-- Keep only the first inserted row (earliest created_at) for each (module_id, name) pair.
-- Also cleans up orphaned evaluation results referencing deleted competencies.
-- ============================================

-- Step 1: Identify duplicates and delete them, keeping the oldest row per (module_id, name)
DELETE FROM public.competencies
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY module_id, name ORDER BY created_at ASC, id ASC) AS rn
    FROM public.competencies
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add a unique constraint to prevent future duplicates
-- (only if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'competencies_module_id_name_unique'
  ) THEN
    ALTER TABLE public.competencies
      ADD CONSTRAINT competencies_module_id_name_unique UNIQUE (module_id, name);
  END IF;
END $$;
