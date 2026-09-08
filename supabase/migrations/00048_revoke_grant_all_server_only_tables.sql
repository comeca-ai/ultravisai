-- P2 da auditoria de 08/set (AUDITORIA.md §3): brief_usage, site_audit_usage
-- e volume_usage nasceram com GRANT ALL pra anon/authenticated (herdado do
-- padrão do template de migration), embora só o server (service_role) leia
-- e escreva essas tabelas — client nenhum as consulta direto.
--
-- Inofensivo hoje: RLS está ativo sem nenhuma policy permissiva, então
-- PostgREST já nega toda operação de anon/authenticated por padrão-fechado.
-- Mas GRANT sobrevive independente de RLS, e é exatamente o tipo de detalhe
-- que uma policy futura mal escrita (ex.: "authenticated pode ler o próprio
-- uso") reabriria pra escrita também, sem ninguém perceber — foi essa
-- combinação (GRANT amplo + policy sem TO service_role) que causou o P0 real
-- da mesma auditoria (migration 00047). Aqui é o mesmo remédio preventivo
-- nas 3 tabelas que ainda não tinham policy nenhuma pra mascarar o problema.

REVOKE ALL ON TABLE "public"."brief_usage" FROM "anon";
REVOKE ALL ON TABLE "public"."brief_usage" FROM "authenticated";

REVOKE ALL ON TABLE "public"."site_audit_usage" FROM "anon";
REVOKE ALL ON TABLE "public"."site_audit_usage" FROM "authenticated";

REVOKE ALL ON TABLE "public"."volume_usage" FROM "anon";
REVOKE ALL ON TABLE "public"."volume_usage" FROM "authenticated";
