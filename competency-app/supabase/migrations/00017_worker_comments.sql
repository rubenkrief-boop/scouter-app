-- ============================================
-- Migration 00017: Worker Comments / Bilans (immutable)
-- ============================================

CREATE TABLE public.worker_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at: comments are immutable
);

CREATE INDEX idx_worker_comments_worker ON public.worker_comments(worker_id);
CREATE INDEX idx_worker_comments_created ON public.worker_comments(created_at);

-- RLS
ALTER TABLE public.worker_comments ENABLE ROW LEVEL SECURITY;

-- Managers, skill masters, super admins can read comments
CREATE POLICY "worker_comments_select" ON public.worker_comments
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('super_admin', 'skill_master', 'manager')
  );

-- Managers, skill masters, super admins can create comments
CREATE POLICY "worker_comments_insert" ON public.worker_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.get_user_role() IN ('super_admin', 'skill_master', 'manager')
  );

-- No update or delete policies: comments are immutable
