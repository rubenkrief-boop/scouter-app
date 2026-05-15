-- Migration 00030 : ON DELETE SET NULL pour les FKs qui réferencent profiles
-- depuis des tables d'historique/audit.
--
-- Contexte : `auth.admin.deleteUser()` cascade sur public.profiles (FK ON
-- DELETE CASCADE) mais la suppression du profil est bloquee par les FK
-- "ON DELETE NO ACTION" suivantes. On les passe en SET NULL pour preserver
-- l'historique tout en autorisant la suppression d'un utilisateur.
--
-- Tables/colonnes concernees :
--   - evaluations.audioprothesiste_id  (l'historique d'eval reste, sans utilisateur)
--   - evaluations.evaluator_id
--   - evaluation_snapshots.snapshot_by
--   - evaluation_comments.author_id
--   - audioprothesiste_assignments.assigned_evaluator_id
--   - competencies.created_by
--   - job_profiles.created_by
--   - modules.created_by
--   - qualifiers.created_by
--   - worker_comments.author_id
--   - profiles.manager_id (un manager supprime ne doit pas bloquer ; ses
--                          subordonnes perdent juste leur lien manager)
--
-- Les colonnes deja CASCADE sont laissees telles quelles :
--   - audioprothesiste_assignments.audioprothesiste_id (assignation, pas
--     d'historique a preserver)
--   - worker_comments.worker_id (commentaires lies a un worker supprime
--     n'ont plus de sens)
--   - planner_locations.profile_id (planning, pas d'historique)
--   - visits.created_by (deja CASCADE)
--   - formation_inscriptions.profile_id (SET NULL, on garde le snapshot)

BEGIN;

-- Helper macro : on drop + recree la FK en SET NULL.

-- evaluations
ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_audioprothesiste_id_fkey;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_audioprothesiste_id_fkey
  FOREIGN KEY (audioprothesiste_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS evaluations_evaluator_id_fkey;
ALTER TABLE public.evaluations
  ADD CONSTRAINT evaluations_evaluator_id_fkey
  FOREIGN KEY (evaluator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- evaluation_snapshots
ALTER TABLE public.evaluation_snapshots
  DROP CONSTRAINT IF EXISTS evaluation_snapshots_snapshot_by_fkey;
ALTER TABLE public.evaluation_snapshots
  ADD CONSTRAINT evaluation_snapshots_snapshot_by_fkey
  FOREIGN KEY (snapshot_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- evaluation_comments
ALTER TABLE public.evaluation_comments
  DROP CONSTRAINT IF EXISTS evaluation_comments_author_id_fkey;
ALTER TABLE public.evaluation_comments
  ADD CONSTRAINT evaluation_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- audioprothesiste_assignments.assigned_evaluator_id (l'audio reste CASCADE)
ALTER TABLE public.audioprothesiste_assignments
  DROP CONSTRAINT IF EXISTS audioprothesiste_assignments_assigned_evaluator_id_fkey;
ALTER TABLE public.audioprothesiste_assignments
  ADD CONSTRAINT audioprothesiste_assignments_assigned_evaluator_id_fkey
  FOREIGN KEY (assigned_evaluator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- competencies / job_profiles / modules / qualifiers : created_by
ALTER TABLE public.competencies
  DROP CONSTRAINT IF EXISTS competencies_created_by_fkey;
ALTER TABLE public.competencies
  ADD CONSTRAINT competencies_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_profiles
  DROP CONSTRAINT IF EXISTS job_profiles_created_by_fkey;
ALTER TABLE public.job_profiles
  ADD CONSTRAINT job_profiles_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.modules
  DROP CONSTRAINT IF EXISTS modules_created_by_fkey;
ALTER TABLE public.modules
  ADD CONSTRAINT modules_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.qualifiers
  DROP CONSTRAINT IF EXISTS qualifiers_created_by_fkey;
ALTER TABLE public.qualifiers
  ADD CONSTRAINT qualifiers_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- worker_comments.author_id (worker_id reste CASCADE)
ALTER TABLE public.worker_comments
  DROP CONSTRAINT IF EXISTS worker_comments_author_id_fkey;
ALTER TABLE public.worker_comments
  ADD CONSTRAINT worker_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- profiles.manager_id (auto-reference : si on supprime un manager, les
-- subordonnes ne sont pas supprimes, ils perdent juste leur lien)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_manager_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMIT;
