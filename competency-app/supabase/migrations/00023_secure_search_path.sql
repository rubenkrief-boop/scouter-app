-- ============================================
-- Migration 00023: secure search_path on SECURITY DEFINER functions
--
-- OWASP recommendation : every SECURITY DEFINER function must pin its
-- search_path to a known schema, otherwise an attacker who can create
-- objects in the user's default search_path could hijack the function
-- body's references (e.g. inject a fake `public.profiles`).
--
-- Six fonctions sont actuellement SECURITY DEFINER sans `SET search_path` :
--   - public.get_user_role()                        (migration 00001)
--   - public.get_module_scores(uuid)                (migration 00001/00002)
--   - public.get_module_tree()                      (migration 00001)
--   - public.handle_updated_at()                    (migration 00001, trigger)
--   - public.get_batch_module_scores(uuid[])        (migration 00007)
--   - public.get_snapshot_history(uuid)             (migration 00013)
--
-- `handle_new_user()` est deja correct (la version de 00006 a `SET search_path`).
--
-- On utilise `ALTER FUNCTION ... SET search_path` qui modifie l'attribut
-- du proc sans toucher au corps — non-destructif.
-- ============================================

ALTER FUNCTION public.get_user_role()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.get_module_scores(uuid)                  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_module_tree()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_batch_module_scores(uuid[])          SET search_path = public, pg_temp;
ALTER FUNCTION public.get_snapshot_history(uuid)               SET search_path = public, pg_temp;

-- Verification : afficher le search_path effectif de chaque fonction
-- apres execution. La colonne `proconfig` doit contenir 'search_path=public,pg_temp'.
SELECT
  n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS function_signature,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'security invoker' END AS security,
  array_to_string(p.proconfig, ', ') AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname IN (
    'get_user_role',
    'get_module_scores',
    'get_module_tree',
    'handle_updated_at',
    'get_batch_module_scores',
    'get_snapshot_history',
    'handle_new_user'
  )
ORDER BY p.proname;
