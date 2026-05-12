-- ============================================
-- Migration 00027: tighten evaluation RLS — managers limited to their team
--
-- Avant : un manager pouvait modifier n'importe quelle evaluation, le
-- badge "lecture seule" dans la page detail etait purement decoratif.
-- Idem pour skill_master qui avait acces ecriture alors qu'il n'a
-- aucune raison metier de modifier les evaluations individuelles
-- (son perimetre = referentiel uniquement).
--
-- Apres :
--   - super_admin     : tout (inchange)
--   - resp_audiologie : tout (nouveau scope full, n'avait rien avant)
--   - manager         : son equipe uniquement (audio.manager_id = auth.uid())
--   - skill_master    : LECTURE SEULE sur evaluations individuelles
--                       (peut toujours lire pour calibrer le referentiel)
--   - worker          : siennes uniquement (inchange)
--
-- Aussi : ajout de 'resp_audiologie' a la SELECT policy (n'y etait pas).
-- ============================================

-- Helper : un user a-t-il le droit d'agir (write) sur une evaluation
-- dont l'audio cible est `p_audio_id` ?
CREATE OR REPLACE FUNCTION public.can_modify_evaluation_of_audio(p_audio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    public.get_user_role() IN ('super_admin', 'resp_audiologie')
    OR (
      public.get_user_role() = 'manager'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_audio_id
          AND p.manager_id = auth.uid()
      )
    );
$$;

-- ============================================
-- 1. evaluations — SELECT (ajout resp_audiologie) / INSERT / UPDATE / DELETE
-- ============================================

DROP POLICY IF EXISTS "evaluations_select" ON public.evaluations;
CREATE POLICY "evaluations_select" ON public.evaluations
  FOR SELECT TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR audioprothesiste_id = auth.uid()
    OR public.get_user_role() IN ('super_admin', 'skill_master', 'manager', 'resp_audiologie')
  );

DROP POLICY IF EXISTS "evaluations_insert" ON public.evaluations;
CREATE POLICY "evaluations_insert" ON public.evaluations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_modify_evaluation_of_audio(audioprothesiste_id));

DROP POLICY IF EXISTS "evaluations_update" ON public.evaluations;
CREATE POLICY "evaluations_update" ON public.evaluations
  FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.can_modify_evaluation_of_audio(audioprothesiste_id)
  );

-- DELETE : on garde super_admin uniquement (suppression d'evaluation est
-- exceptionnelle, on ne veut pas donner ce pouvoir aux managers ni
-- resp_audiologie).
DROP POLICY IF EXISTS "evaluations_delete" ON public.evaluations;
CREATE POLICY "evaluations_delete" ON public.evaluations
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- ============================================
-- 2. evaluation_results — INSERT / UPDATE / DELETE filtres via parent eval
-- ============================================

DROP POLICY IF EXISTS "eval_results_insert" ON public.evaluation_results;
CREATE POLICY "eval_results_insert" ON public.evaluation_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

DROP POLICY IF EXISTS "eval_results_update" ON public.evaluation_results;
CREATE POLICY "eval_results_update" ON public.evaluation_results
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

DROP POLICY IF EXISTS "eval_results_delete" ON public.evaluation_results;
CREATE POLICY "eval_results_delete" ON public.evaluation_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluations e
      WHERE e.id = evaluation_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

-- ============================================
-- 3. evaluation_result_qualifiers — meme logique via JOIN sur eval parent
-- ============================================

DROP POLICY IF EXISTS "erq_insert" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_insert" ON public.evaluation_result_qualifiers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluation_results er
      JOIN public.evaluations e ON e.id = er.evaluation_id
      WHERE er.id = evaluation_result_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

DROP POLICY IF EXISTS "erq_update" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_update" ON public.evaluation_result_qualifiers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_results er
      JOIN public.evaluations e ON e.id = er.evaluation_id
      WHERE er.id = evaluation_result_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

DROP POLICY IF EXISTS "erq_delete" ON public.evaluation_result_qualifiers;
CREATE POLICY "erq_delete" ON public.evaluation_result_qualifiers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_results er
      JOIN public.evaluations e ON e.id = er.evaluation_id
      WHERE er.id = evaluation_result_id
        AND (
          e.evaluator_id = auth.uid()
          OR public.can_modify_evaluation_of_audio(e.audioprothesiste_id)
        )
    )
  );

-- ============================================
-- Verification
-- ============================================

SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL AND qual LIKE '%can_modify_evaluation_of_audio%' THEN 'tightened'
    WHEN qual IS NOT NULL AND qual LIKE '%''manager''%' THEN 'still broad (CHECK NEEDED)'
    ELSE 'other'
  END AS state
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('evaluations', 'evaluation_results', 'evaluation_result_qualifiers')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename, cmd, policyname;
