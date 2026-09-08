-- 00046_ranking_unificado.sql
-- Ultravis (fork layer) — uma fonte só para o ranking.
--
-- Problema que isto resolve (levantamento em ajustar.md, 07/set): o ranking
-- médio do Insights e a dimensão Posição do Score eram contas DIFERENTES,
-- feitas em lugares diferentes, sobre populações diferentes:
--
--   * o Insights calculava SUM(appearance_rank)/COUNT(*) aqui, no RPC;
--   * o Score nem calculava média — distribuía em 1º/2º/3º/4º+ no
--     TypeScript e transformava isso numa nota de pódio (100/60/30/0),
--     lendo as linhas por fora, sem os filtros do RPC e com teto de 50 mil
--     linhas.
--
-- Escrever a mesma fórmula duas vezes (SQL + TS) é convite à divergência: a
-- primeira mudança de um lado só quebra o acordo e ninguém percebe até um
-- cliente reclamar. Então a conta desce inteira para cá e as duas telas
-- passam a LER o mesmo número.
--
-- O que entra:
--   * rank_avg      — a média pronta (antes cada consumidor dividia sozinho:
--                     divisão duplicada é divergência esperando acontecer);
--   * pos_score_sum — soma das notas de posição RELATIVAS AO CAMPO;
--   * pos_sem_rival — respostas em que nenhum concorrente foi citado.
--
-- Por que a nota é relativa ao campo: ficar em 3,3º entre 3 concorrentes é
-- ruim e entre 20 é excelente. A conta antiga (pódio) e a primeira proposta
-- de substituição (100/média) davam o mesmo número nos dois casos. Usando
-- appearance_rivals — gravado desde a 00043 e até hoje nunca lido por
-- ninguém — a nota vira a fração do campo que a marca ganha:
--
--     nota = (rivais + 1 - posição) / rivais * 100
--
-- 1º entre 3 = 100, último = 0. Sem rival citado (rivais = 0) a marca estava
-- sozinha no texto, que é o melhor resultado possível: nota 100, mas contado
-- à parte em pos_sem_rival, porque 100 obtido sem adversário é frágil e a
-- tela precisa poder dizer isso.
--
-- A nota é calculada POR RESPOSTA e só então somada: o tamanho do campo muda
-- de linha para linha, então normalizar depois da média daria outro número.
--
-- Aditivo: só acrescenta chaves ao jsonb. Consumidor antigo segue lendo o que
-- lia. Mesma CTE de filtros dos demais números, por construção.
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
           pr.sentiment, pr.model_used, pr.created_at,
           pr.appearance_rank, pr.appearance_rivals
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
      -- Nota de posição relativa ao campo, somada por resposta.
      -- COALESCE no rivals porque linhas anteriores à 00043 podem ter a
      -- coluna nula: sem saber o campo, o mais honesto é tratar como
      -- "sozinha" (100) — é o mesmo que a conta antiga fazia com um 1º lugar.
      COALESCE(SUM(
        CASE
          WHEN COALESCE(appearance_rivals, 0) >= 1
            THEN GREATEST(
                   (COALESCE(appearance_rivals, 0) + 1 - appearance_rank)::numeric
                     / COALESCE(appearance_rivals, 0) * 100,
                   0)
          ELSE 100
        END
      ) FILTER (WHERE appearance_rank >= 1), 0)                AS pos_score_sum,
      COUNT(*) FILTER (WHERE appearance_rank >= 1
                         AND COALESCE(appearance_rivals, 0) = 0) AS pos_sem_rival,
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
    -- Média pronta: uma divisão, um lugar. NULL sem amostra (e não 0, que
    -- leria como "primeiro lugar" na escala em que menor é melhor).
    'rank_avg', CASE WHEN t.rank_count > 0
                     THEN ROUND(t.rank_sum::numeric / t.rank_count, 1)
                END,
    -- Nota 0-100 da dimensão Posição do Score. Mesma amostra da média.
    'pos_score', CASE WHEN t.rank_count > 0
                      THEN ROUND(t.pos_score_sum / t.rank_count)
                 END,
    'pos_score_sum',       t.pos_score_sum,
    'pos_sem_rival',       t.pos_sem_rival,
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

-- Mesmo padrão de 00014/00033/00044: RLS do chamador vale (não o dono).
ALTER FUNCTION public.insights_aggregates(
  uuid, text, text[], text, timestamptz, timestamptz, uuid, uuid
) SECURITY INVOKER;
