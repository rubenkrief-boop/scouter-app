-- Migration 00013: Evaluation continue avec snapshots automatiques
-- Passe du modele "creer → remplir → terminer" au modele continu

-- ============================================================
-- 1. Table evaluation_snapshots
-- ============================================================
CREATE TABLE public.evaluation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  snapshot_by UUID NOT NULL REFERENCES public.profiles(id),
  scores JSONB NOT NULL,
  module_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_eval_date ON public.evaluation_snapshots(evaluation_id, created_at DESC);
CREATE INDEX idx_snapshots_by ON public.evaluation_snapshots(snapshot_by);

ALTER TABLE public.evaluation_snapshots ENABLE ROW LEVEL SECURITY;

-- Lecture : evaluateurs, admin, managers, et le collaborateur evalue
CREATE POLICY "snapshots_select" ON public.evaluation_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
      AND (
        e.evaluator_id = auth.uid()
        OR e.audioprothesiste_id = auth.uid()
        OR public.get_user_role() IN ('super_admin', 'skill_master', 'manager')
      )
    )
  );

-- Insertion : evaluateurs et admins uniquement
CREATE POLICY "snapshots_insert" ON public.evaluation_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    snapshot_by = auth.uid()
    AND public.get_user_role() IN ('manager', 'super_admin', 'skill_master')
  );

-- Pas de update/delete : les snapshots sont immuables

-- ============================================================
-- 2. Flag is_continuous sur evaluations
-- ============================================================
ALTER TABLE public.evaluations
  ADD COLUMN is_continuous BOOLEAN NOT NULL DEFAULT false;

-- Contrainte unique partielle : une seule evaluation continue par collaborateur
CREATE UNIQUE INDEX idx_one_continuous_eval
  ON public.evaluations(audioprothesiste_id, COALESCE(job_profile_id, '00000000-0000-0000-0000-000000000000'))
  WHERE is_continuous = true;

-- ============================================================
-- 3. Fonction RPC get_snapshot_history
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_snapshot_history(p_evaluation_id UUID)
RETURNS TABLE(
  snapshot_id UUID,
  snapshot_date TIMESTAMPTZ,
  snapshot_by_name TEXT,
  module_scores JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS snapshot_id,
    s.created_at AS snapshot_date,
    (p.first_name || ' ' || p.last_name) AS snapshot_by_name,
    s.module_scores
  FROM public.evaluation_snapshots s
  JOIN public.profiles p ON p.id = s.snapshot_by
  WHERE s.evaluation_id = p_evaluation_id
  ORDER BY s.created_at DESC;
END;
$$;
