-- Ultravis addition (fork layer — additive migration).
--
-- Share Direto × Orgânico (doc de lógica de 17/ago; feature dos 3 pacotes):
-- prompts que citam a marca pelo nome ("share direto") passam a ser marcados
-- para que o dashboard consiga separar os dois recortes. Prompts existentes
-- são todos de categoria (orgânico) — validado em produção em 15/ago:
-- 0 de 196 prompts continham o nome da marca.
--
-- O seed dos 4 prompts de marca por marca ativa é operação de DADOS (feita
-- via MCP no mesmo dia), não de schema — novas marcas ganham os seus no
-- fluxo de produto (follow-up no BACKLOG).

alter table public.prompts
  add column if not exists is_brand_prompt boolean not null default false;

comment on column public.prompts.is_brand_prompt is
  'true = prompt cita a marca pelo nome (share direto); false = prompt de categoria (share orgânico).';
