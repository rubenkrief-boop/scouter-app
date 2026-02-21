-- ============================================
-- Migration 00010: Add job_title column to profiles
-- This column was referenced in code but never created in the database.
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.job_title IS 'Job title / function of the user (e.g., Audioprothésiste, Assistante technique)';
