-- ============================================
-- Migration 00005: Evaluation Comments (immutable)
-- ============================================

CREATE TABLE public.evaluation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at: comments are immutable
);

CREATE INDEX idx_eval_comments_evaluation ON public.evaluation_comments(evaluation_id);
CREATE INDEX idx_eval_comments_created ON public.evaluation_comments(created_at);

-- RLS
ALTER TABLE public.evaluation_comments ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read comments on evaluations they have access to
CREATE POLICY "eval_comments_select" ON public.evaluation_comments
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

-- Only evaluator, manager, super_admin can create comments
CREATE POLICY "eval_comments_insert" ON public.evaluation_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_user_role() IN ('evaluator', 'manager', 'super_admin')
  );

-- No update or delete policies: comments are immutable
