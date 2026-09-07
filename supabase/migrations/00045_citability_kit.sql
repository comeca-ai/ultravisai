-- Kit de citabilidade: as peças prontas pra colar que nascem da auditoria
-- (llms.txt, liberação dos bots de IA no robots.txt, JSON-LD de organização e
-- de FAQ, bloco de meta tags).
--
-- Por que coluna nova e não dentro de `recommendations`: recomendação é texto
-- pro humano ler e decidir; peça do kit é arquivo pra publicar, com caminho de
-- destino e linguagem própria. Misturar os dois obrigaria a tela a adivinhar
-- qual é qual, e o histórico de auditorias antigas ficaria ambíguo.
--
-- Nulo = auditoria anterior a esta migration (o kit não existia). Lista vazia =
-- rodou e a página não precisava de nenhuma peça — que é o melhor resultado
-- possível, e a tela precisa distinguir um do outro.
alter table public.site_audits
  add column if not exists citability_kit jsonb;

comment on column public.site_audits.citability_kit is
  'Peças prontas pra colar geradas a partir dos sinais que falharam. NULL = auditoria anterior ao recurso; [] = nada a corrigir.';
