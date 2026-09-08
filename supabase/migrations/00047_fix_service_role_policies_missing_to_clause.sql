-- 00047_fix_service_role_policies_missing_to_clause.sql
--
-- P0 da auditoria de 08/set: 5 policies nomeadas "Service role can X" foram
-- criadas em 00001/00011 SEM a cláusula `TO service_role`. Em Postgres, uma
-- policy sem TO se aplica a PUBLIC — ou seja, a TODO papel, inclusive `anon`
-- (a chave pública embutida no bundle do Next.js) e `authenticated`. Como
-- service_role já ignora RLS nativamente (BYPASSRLS), essas policies nunca
-- protegeram nada: só abriram DELETE/INSERT irrestrito (USING/CHECK true,
-- sem checar brand_id/organization_id) em prompt_results, ai_traffic_logs e
-- prompt_result_shopping_cards para qualquer requisição direta ao PostgREST
-- autenticada só com a anon key — sem login.
--
-- Fix: dropar as 5 policies (o service_role não precisa de nenhuma policy) e
-- revogar INSERT/UPDATE/DELETE de anon/authenticated nas 3 tabelas, mantendo
-- apenas o SELECT já corretamente escopado por organização (policies "Users
-- can read own org prompt results" / "shopping_cards: org member select" /
-- equivalente em ai_traffic_logs, todas preservadas por esta migration).

DROP POLICY IF EXISTS "Service role can delete prompt results" ON public.prompt_results;
DROP POLICY IF EXISTS "Service role can insert prompt results" ON public.prompt_results;
DROP POLICY IF EXISTS "Service role can insert traffic logs" ON public.ai_traffic_logs;
DROP POLICY IF EXISTS "Service role can insert shopping cards" ON public.prompt_result_shopping_cards;
DROP POLICY IF EXISTS "Service role can delete shopping cards" ON public.prompt_result_shopping_cards;

REVOKE INSERT, UPDATE, DELETE ON public.prompt_results FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_traffic_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.prompt_result_shopping_cards FROM anon, authenticated;
