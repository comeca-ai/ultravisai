-- 00044_insights_summary_v2.sql
-- Ultravis (fork layer) — resumo de visibilidade da reunião de 19/ago:
-- o painel do Insights passa a mostrar 3 coisas, sem nota ponderada
-- (Igor 42:22: "percentual de prompts sobre o total, um ranking e um
-- sentimento — eu não preciso ter uma nota ponderada disso").
--
-- Estende insights_aggregates (definição anterior: 00033) com:
--   * sent_pos / sent_neu / sent_neg — sentimento ENTRE respostas com a
--     marca (mention_count > 0; a análise é pulada nas demais);
--   * rank_count / rank_sum / rank_1..rank_5 / rank_gt5 — ranking por
--     ordem de aparição (appearance_rank, 00043; >= 1 = calculado),
--     para média (#2,4) e distribuição #1..#5 / >#5 dos post-its P1.
-- Mesma CTE de filtros — os números novos obedecem aos MESMOS filtros dos
-- antigos por construção (família de bugs "telas que não fecham").
CREATE OR REPLACE FUNCTION public.insights_aggregates(
  p_brand_id   uuid,
  p_platform   text         DEFAULT NULL,
  p_models     text[]       DEFAULT NULL,
  p_region     text         DEFAULT NULL,
  p_date_from  timestamptz  DEFAULT NULL,
  p_date_to    timestamptz  DEFAULT NULL,
  p_prompt_id  uuid         DEFAULT NULL,
  p_topic_id   uuid         DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT pr.visibility_score, pr.mention_count, pr.citation_count,
           pr.sentiment, pr.model_used, pr.created_at, pr.appearance_rank
    FROM public.prompt_results pr
    WHERE pr.brand_id = p_brand_id
      AND pr.platform <> 'chatgpt-shopping'  -- #155 — isolate from Insights
      AND (p_platform  IS NULL OR pr.platform    = p_platform)
      AND (p_models    IS NULL OR pr.model_used  = ANY (p_models))
      AND (p_region    IS NULL OR pr.region      = p_region)
      AND (p_date_from IS NULL OR pr.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR pr.created_at <= p_date_to)
      AND (p_prompt_id IS NULL OR pr.prompt_id   = p_prompt_id)
      AND (p_topic_id  IS NULL OR EXISTS (
             SELECT 1 FROM public.prompts p
             WHERE p.id = pr.prompt_id AND p.topic_id = p_topic_id))
  ),
  totals AS (
    SELECT
      COUNT(*)                                                AS total_results,
      COALESCE(SUM(visibility_score), 0)                      AS sum_visibility,
      COALESCE(SUM(mention_count), 0)                         AS total_mentions,
      COALESCE(SUM(citation_count), 0)                        AS total_citations,
      COUNT(*) FILTER (WHERE sentiment = 'positive')          AS positive_count,
      COUNT(*) FILTER (WHERE mention_count > 0
                          OR citation_count > 0)               AS mentioning_results,
      COUNT(*) FILTER (WHERE mention_count > 0
                         AND sentiment = 'positive')           AS sent_pos,
      COUNT(*) FILTER (WHERE mention_count > 0
                         AND sentiment = 'neutral')            AS sent_neu,
      COUNT(*) FILTER (WHERE mention_count > 0
                         AND sentiment = 'negative')           AS sent_neg,
      COUNT(*) FILTER (WHERE appearance_rank >= 1)             AS rank_count,
      COALESCE(SUM(appearance_rank)
                 FILTER (WHERE appearance_rank >= 1), 0)       AS rank_sum,
      COUNT(*) FILTER (WHERE appearance_rank = 1)              AS rank_1,
      COUNT(*) FILTER (WHERE appearance_rank = 2)              AS rank_2,
      COUNT(*) FILTER (WHERE appearance_rank = 3)              AS rank_3,
      COUNT(*) FILTER (WHERE appearance_rank = 4)              AS rank_4,
      COUNT(*) FILTER (WHERE appearance_rank = 5)              AS rank_5,
      COUNT(*) FILTER (WHERE appearance_rank > 5)              AS rank_gt5,
      MAX(created_at)                                         AS last_checked_at
    FROM filtered
  ),
  by_model AS (
    SELECT
      COALESCE(model_used, 'unknown') AS model_used,
      SUM(visibility_score)           AS sum_visibility,
      COUNT(*)                        AS result_count
    FROM filtered
    GROUP BY COALESCE(model_used, 'unknown')
  )
  SELECT jsonb_build_object(
    'total_results',       t.total_results,
    'sum_visibility',      t.sum_visibility,
    'total_mentions',      t.total_mentions,
    'total_citations',     t.total_citations,
    'positive_count',      t.positive_count,
    'mentioning_results',  t.mentioning_results,
    'sent_pos',            t.sent_pos,
    'sent_neu',            t.sent_neu,
    'sent_neg',            t.sent_neg,
    'rank_count',          t.rank_count,
    'rank_sum',            t.rank_sum,
    'rank_1',              t.rank_1,
    'rank_2',              t.rank_2,
    'rank_3',              t.rank_3,
    'rank_4',              t.rank_4,
    'rank_5',              t.rank_5,
    'rank_gt5',            t.rank_gt5,
    'last_checked_at',     t.last_checked_at,
    'by_model', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'model_used',     bm.model_used,
                'sum_visibility', bm.sum_visibility,
                'result_count',   bm.result_count)
              ORDER BY bm.result_count DESC, bm.model_used)
       FROM by_model bm),
      '[]'::jsonb)
  )
  FROM totals t;
$$;

-- Mesmo padrão de 00014/00033: RLS do chamador vale (não o dono da função).
ALTER FUNCTION public.insights_aggregates(
  uuid, text, text[], text, timestamptz, timestamptz, uuid, uuid
) SECURITY INVOKER;
