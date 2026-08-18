-- Ultravis addition (fork layer — additive migration).
--
-- Pesos calibráveis do Índice de Citabilidade (IC). Os pesos-prior vêm do
-- framework (estrategia/indice-citabilidade.md) e são "sujeitos a calibração
-- empírica contra a Visibilidade observada" (doc de lógica de 17/ago).
-- Esta tabela permite calibrar SEM deploy: o painel /ops (operador, Basic
-- Auth) edita via service role; o app lê. Sem linha na tabela, o app usa os
-- defaults do config — a tabela é override, não fonte obrigatória.

create table if not exists public.index_weights (
  dim_key text primary key
    check (dim_key in ('dim1', 'dim2', 'dim3', 'dim4', 'dim5', 'dim6')),
  weight integer not null check (weight >= 0 and weight <= 100),
  updated_at timestamptz not null default now()
);

comment on table public.index_weights is
  'Pesos (%) das 6 dimensões do Índice de Citabilidade. Editados só pelo operador via /ops (service role); leitura pelo app. Devem somar 100.';

alter table public.index_weights enable row level security;

-- Leitura para qualquer usuário logado (pesos não são segredo — aparecem na
-- fórmula aberta da tela). Escrita: nenhuma policy → só service role.
create policy "index_weights: authenticated read"
  on public.index_weights for select
  to authenticated
  using (true);

-- Seed com os pesos-prior do framework (22/20/18/15/13/12 por dimensão).
insert into public.index_weights (dim_key, weight) values
  ('dim1', 15),
  ('dim2', 20),
  ('dim3', 12),
  ('dim4', 18),
  ('dim5', 22),
  ('dim6', 13)
on conflict (dim_key) do nothing;
