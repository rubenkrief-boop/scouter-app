-- ============================================
-- Migration 00025: trace de l'acceptation des CGU par chaque utilisateur
--
-- Article 1366 du Code Civil : un consentement electronique est valide
-- s'il peut etre prouve. On stocke donc :
--   - la version des CGU acceptee
--   - la date/heure UTC de l'acceptation
--
-- A chaque mise a jour substantielle des CGU, on bumpe le constant
-- LEGAL_VERSION cote app (src/lib/legal.ts) ; les utilisateurs dont la
-- version stockee differe sont re-promptes au prochain login.
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_accepted_version TEXT,
  ADD COLUMN IF NOT EXISTS legal_accepted_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.legal_accepted_version IS
  'Version des CGU acceptees par l''utilisateur (vide = jamais acceptees, prompt au prochain login).';
COMMENT ON COLUMN public.profiles.legal_accepted_at IS
  'Horodatage UTC de l''acceptation. A des fins de preuve (art. 1366 Code Civil).';

-- Verification post-migration
SELECT
  column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('legal_accepted_version', 'legal_accepted_at')
ORDER BY column_name;
