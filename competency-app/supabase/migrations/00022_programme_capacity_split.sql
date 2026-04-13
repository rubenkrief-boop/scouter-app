-- ============================================
-- Migration 00022: Split programme capacity by Succursale / Franchise
-- Replace single max_places with max_succ + max_franchise
-- ============================================

-- 1. Add new columns
ALTER TABLE public.formation_programme_settings
  ADD COLUMN max_succ INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.formation_programme_settings
  ADD COLUMN max_franchise INTEGER NOT NULL DEFAULT 0;

-- 2. Migrate existing data: existing max_places goes to max_succ
UPDATE public.formation_programme_settings
  SET max_succ = max_places;

-- 3. Drop old column
ALTER TABLE public.formation_programme_settings
  DROP COLUMN max_places;
