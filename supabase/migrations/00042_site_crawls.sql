-- Ultravis addition — varredura multi-página do site (dimensão 01 do Índice
-- de Citabilidade). Uma linha por varredura (histórico preservado); `pages` e
-- `coverage` em jsonb: pages = [{url, score, signals:{key:status}}],
-- coverage = {signal_key: {pass, evaluated}} ("Org schema em 8/10 páginas").

create table if not exists public.site_crawls (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  origin text not null,
  page_count integer,
  pages_scored integer,
  score numeric,
  pages jsonb,
  coverage jsonb,
  created_at timestamptz not null default now()
);

comment on table public.site_crawls is
  'Varredura multi-página (Ultravis): sinais determinísticos do site audit rodados nas ~10 páginas-chave; alimenta a dimensão 01 do Índice de Citabilidade.';

create index if not exists site_crawls_brand_created_idx
  on public.site_crawls (brand_id, created_at desc);

alter table public.site_crawls enable row level security;

-- Leitura: membros da organização dona da marca (mesmo padrão de brand_domains).
create policy "site_crawls_member_select" on public.site_crawls
  for select to authenticated
  using (
    brand_id in (
      select b.id
      from public.brands b
      join public.profiles p on p.organization_id = b.organization_id
      where p.id = auth.uid()
    )
  );

-- Escrita: apenas service role (o server grava; nenhum caminho de escrita no app).
