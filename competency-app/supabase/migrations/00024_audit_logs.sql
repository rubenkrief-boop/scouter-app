-- ============================================
-- Migration 00024: Audit log for sensitive admin actions
--
-- Trace immuable des actions admin sensibles (changement de role,
-- desactivation utilisateur, suppression d'evaluation, etc.) pour
-- forensique en cas de compte compromis.
-- Aligne sur le pattern 3DFit (migration 00025_audit_logs).
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- e.g. 'user.role_changed', 'user.deactivated', 'evaluation.deleted'
  action        TEXT NOT NULL,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- L'entite ciblee par l'action (when applicable).
  target_id     UUID,
  -- Metadonnees libres (JSONB). Le caller DOIT redact les PII avant insert
  -- via le helper redact() de src/lib/utils-app/redact.ts.
  metadata      JSONB,
  ip            TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON public.audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs(action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les super_admin peuvent lire. Pas d'UPDATE/DELETE policy : la table
-- est append-only (tout caller utilise le service role pour INSERT, donc
-- bypass RLS pour l'ecriture).
DROP POLICY IF EXISTS "Super admins read audit logs" ON public.audit_logs;
CREATE POLICY "Super admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- Verification post-migration
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs') AS policy_count
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'audit_logs';
