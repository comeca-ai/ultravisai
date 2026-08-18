-- Ultravis addition — Posição por ordem de aparição (premissa do dono, 18/ago):
-- em cada resposta em que a marca aparece, appearance_rank = 1 + concorrentes
-- citados ANTES dela no texto (1 = citada primeiro); appearance_rivals = nº de
-- concorrentes presentes na resposta. NULL = ainda não calculado (o
-- enriquecimento do server preenche, histórico incluído); 0 = não computável
-- (marca apagada / sem contexto).

alter table public.prompt_results
  add column if not exists appearance_rank integer,
  add column if not exists appearance_rivals integer;

comment on column public.prompt_results.appearance_rank is
  'Ultravis: posição da marca por ordem de 1ª menção no texto da resposta (1 = citada primeiro; 0 = não computável; NULL = pendente de cálculo).';
comment on column public.prompt_results.appearance_rivals is
  'Ultravis: nº de concorrentes mencionados na mesma resposta (contexto do appearance_rank).';

-- O enriquecimento varre "menção > 0 e rank ainda nulo" a cada 30 min.
create index if not exists prompt_results_appearance_pending_idx
  on public.prompt_results (created_at desc)
  where appearance_rank is null and mention_count > 0;
