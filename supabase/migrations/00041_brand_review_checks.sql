-- Ultravis addition (fork layer — additive migration).
--
-- Checagem direta de plataformas de review (dimensão 04 do IC). O dado de
-- 15/ago provou que as IAs quase não citam plataformas de review (0-9
-- citações por censo), então a nota do D4 não pode nascer das citações —
-- nasce da checagem direta dos perfis da marca (régua do doc de 17/ago:
-- presença/nota/volume nas plataformas do mercado).
--
-- Coleta: server (egress aberto) via lib/review-check.js, semanal + boot.
-- found = null significa "não conseguimos verificar" (plataforma bloqueou) —
-- declarado na UI, nunca tratado como ausência.

create table if not exists public.brand_review_checks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  url text,
  found boolean,
  rating numeric,
  review_count integer,
  checked_at timestamptz not null default now(),
  unique (brand_id, platform)
);

create index if not exists idx_brand_review_checks_brand_id
  on public.brand_review_checks (brand_id);

comment on table public.brand_review_checks is
  'Checagem direta de perfis de review por marca (D4 do IC). Escrita só pelo server (service role); found=null = não verificável (declarado).';

alter table public.brand_review_checks enable row level security;

-- Leitura para membros da organização dona da marca (mesmo padrão de
-- brand_domains). Escrita: nenhuma policy → só service role.
create policy "brand_review_checks: member select"
  on public.brand_review_checks for select
  using (brand_id in (
    select b.id
    from public.brands b
    join public.profiles p on p.organization_id = b.organization_id
    where p.id = auth.uid()
  ));
