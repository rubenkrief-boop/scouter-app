-- ============================================
-- Batch module scores function for statistics performance
-- Replaces N+1 get_module_scores calls with a single batch call
-- ============================================

CREATE OR REPLACE FUNCTION public.get_batch_module_scores(p_evaluation_ids UUID[])
RETURNS TABLE(
  evaluation_id UUID,
  module_id UUID,
  module_code TEXT,
  module_name TEXT,
  actual_score NUMERIC,
  total_possible NUMERIC,
  completion_pct NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS evaluation_id,
    m.id AS module_id,
    m.code AS module_code,
    m.name AS module_name,
    COALESCE(SUM(qo.value), 0) AS actual_score,
    COALESCE(SUM(max_qo.max_value), GREATEST(COUNT(DISTINCT c.id), 1) * 1.0) AS total_possible,
    CASE
      WHEN COUNT(DISTINCT c.id) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(qo.value), 0) / GREATEST(COALESCE(SUM(max_qo.max_value), 1), 1)) * 100,
        1
      )
    END AS completion_pct
  FROM unnest(p_evaluation_ids) AS eval_id
  JOIN public.evaluations e ON e.id = eval_id
  CROSS JOIN public.modules m
  JOIN public.competencies c ON c.module_id = m.id
  LEFT JOIN public.evaluation_results er
    ON er.competency_id = c.id AND er.evaluation_id = e.id
  LEFT JOIN public.evaluation_result_qualifiers erq
    ON erq.evaluation_result_id = er.id
  LEFT JOIN public.qualifier_options qo
    ON qo.id = erq.qualifier_option_id
  LEFT JOIN LATERAL (
    SELECT MAX(qo2.value) AS max_value
    FROM public.qualifier_options qo2
    WHERE qo2.qualifier_id = erq.qualifier_id
  ) max_qo ON true
  WHERE m.parent_id IS NULL AND m.is_active = true
  GROUP BY e.id, m.id, m.code, m.name, m.sort_order
  ORDER BY m.sort_order;
END;
$$;
