-- ============================================
-- Migration 00029: Add 'gerant_franchise' to user_role enum
--
-- Nouveau rôle pour les gérants de centres franchisés Vivason :
--   - Accès UNIQUEMENT à la partie Formations (comme formation_user)
--   - PLUS la capacité de gérer son équipe : voir ses salariés
--     (les formation_user où manager_id = lui) et les inscrire aux
--     formations à leur place.
--   - Pas d'accès aux compétences, aux évaluations, aux visites, ni au
--     référentiel skill-master.
--
-- Note Postgres : ALTER TYPE ... ADD VALUE doit etre execute en dehors
-- de tout transaction block (CREATE TYPE est transactionnel mais l'ajout
-- d'une valeur ne l'est pas). Cette migration ne contient qu'une seule
-- instruction pour cette raison.
-- ============================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'gerant_franchise';
