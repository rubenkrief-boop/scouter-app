-- ============================================
-- Migration 00028: Axe orthogonal "statut" (Succursale / Franchise)
--
-- Jusqu'a present le statut Succursale/Franchise etait DEDUIT du role
-- (role=formation_user => Franchise, sinon => Succursale). Cela couplait
-- deux concepts independants : la PERMISSION (role) et l'AFFILIATION
-- organisationnelle (statut).
--
-- Cette migration decouple les deux : ajout d'une colonne `statut` qui
-- vaut 'succursale' par defaut, et 'franchise' uniquement pour les
-- profils actuellement formation_user (backfill conservant le comportement).
--
-- Ainsi :
--   - role           = ce qu'on a le droit de faire dans l'app
--   - job_title      = metier reel (pour le referentiel competences)
--   - statut         = Succursale/Franchise (pour les formations et listes)
--
-- Aucune ligne d'historique n'est modifiee. La table formation_inscriptions
-- garde son snapshot intact. La nouvelle colonne sert uniquement aux
-- FUTURES inscriptions et aux listes utilisateurs.
-- ============================================

-- 1. Colonne (CHECK simple pour eviter de creer un ENUM dedicace —
--    plus facile a evoluer plus tard si on ajoute des cas).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'succursale'
  CHECK (statut IN ('succursale', 'franchise'));

-- 2. Backfill : tous les formation_user actuels deviennent franchise
--    (correspondance pile poil avec le calcul actuel dans formations.ts).
UPDATE public.profiles
SET statut = 'franchise'
WHERE role = 'formation_user' AND statut <> 'franchise';

-- 3. Verification
SELECT
  role,
  statut,
  count(*) AS nb_profils
FROM public.profiles
GROUP BY role, statut
ORDER BY statut, role;
