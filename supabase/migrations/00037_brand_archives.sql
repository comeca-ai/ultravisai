-- Ultravis addition (fork layer — additive, no core changes).
--
-- Arquivo-morto de marcas: sempre que uma marca é apagada (pelo app, MCP ou
-- SQL), um gatilho BEFORE DELETE empacota a marca e TODOS os dados
-- relacionados num payload JSONB (comprimido pelo TOAST do Postgres) na
-- tabela brand_archives, com identificador próprio. Nada se perde numa
-- exclusão — o histórico pode ser consultado ou reimportado depois.
--
-- Server-only: RLS habilitado sem policies (mesmo padrão de jobs/
-- prompt_volumes) — o app não lê nem escreve aqui; só service_role.

create table if not exists public.brand_archives (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  brand_name text not null,
  organization_id uuid,
  archived_at timestamptz not null default now(),
  payload jsonb not null
);

comment on table public.brand_archives is
  'Snapshot completo (JSONB) de cada marca apagada e seus dados relacionados. Preenchida automaticamente pelo gatilho brands_archive_before_delete.';

create index if not exists brand_archives_brand_id_idx on public.brand_archives (brand_id);
create index if not exists brand_archives_org_idx on public.brand_archives (organization_id);

alter table public.brand_archives enable row level security;

-- SECURITY DEFINER: o gatilho roda com os direitos do dono (postgres) para
-- poder inserir no arquivo-morto mesmo quando quem apaga é um usuário do
-- app sob RLS.
create or replace function public.archive_brand_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  chunk jsonb;
  data jsonb := '{}'::jsonb;
begin
  -- Toda tabela com coluna brand_id, descoberta na hora do delete — tabelas
  -- novas entram no arquivo automaticamente, sem tocar neste gatilho.
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = 'public'
     and tb.table_name = c.table_name
     and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name = 'brand_id'
      and c.table_name <> 'brand_archives'
      and c.table_name <> 'brands'
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I x where x.brand_id = $1',
      t.table_name
    ) into chunk using old.id;
    if chunk <> '[]'::jsonb then
      data := data || jsonb_build_object(t.table_name, chunk);
    end if;
  end loop;

  -- prompts pendem de prompt_sets (não têm brand_id direto)
  begin
    execute 'select coalesce(jsonb_agg(to_jsonb(p)), ''[]''::jsonb) from prompts p
             where p.prompt_set_id in (select id from prompt_sets where brand_id = $1)'
      into chunk using old.id;
    if chunk <> '[]'::jsonb then
      data := data || jsonb_build_object('prompts', chunk);
    end if;
  exception when others then null; -- arquivar nunca pode impedir o delete
  end;

  -- prompt_volumes pendem de prompts
  begin
    execute 'select coalesce(jsonb_agg(to_jsonb(v)), ''[]''::jsonb) from prompt_volumes v
             where v.prompt_id in (
               select p.id from prompts p
               where p.prompt_set_id in (select id from prompt_sets where brand_id = $1))'
      into chunk using old.id;
    if chunk <> '[]'::jsonb then
      data := data || jsonb_build_object('prompt_volumes', chunk);
    end if;
  exception when others then null;
  end;

  insert into public.brand_archives (brand_id, brand_name, organization_id, payload)
  values (
    old.id,
    old.name,
    old.organization_id,
    jsonb_build_object('brand', to_jsonb(old), 'tables', data)
  );

  return old;
end;
$$;

drop trigger if exists brands_archive_before_delete on public.brands;
create trigger brands_archive_before_delete
  before delete on public.brands
  for each row execute function public.archive_brand_before_delete();
