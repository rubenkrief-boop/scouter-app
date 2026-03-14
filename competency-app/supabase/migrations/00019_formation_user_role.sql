-- ============================================
-- Migration 00019: Add formation_user role
-- Franchise employees who see only formations
-- and a simplified profile (no evaluations).
-- ============================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'formation_user';

-- No RLS changes needed:
-- - formation_* tables: SELECT is open to all authenticated users
-- - evaluation tables: only expose rows where user is evaluator/audioprothesiste
--   (formation_user never appears in those columns, so they see nothing)
