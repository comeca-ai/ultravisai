-- ============================================================================
-- CONSOLIDAÇÃO POLAR — decisão do dono, 29/ago/2026
-- "consolidar e garantir que os números se conversem"
--
-- Situação: duas marcas ativas na mesma organização ("Polar Electro" ×
-- "Polar") desde ~27/ago — o vigia alerta consistency-sibling-brands a cada
-- ciclo, e as menções se dividem entre as duas (mesma família dos bugs de
-- contagem da semana de 19/ago).
--
-- O que este script faz (idempotente — rodar duas vezes não muda nada):
--   1. Garante o alias "Polar" em "Polar Electro" (menções a "Polar" passam
--      a contar pra marca consolidada — ingest E backfill usam brands.aliases).
--   2. Apaga a marca duplicada "Polar" — o gatilho brands_archive_before_delete
--      (migration 00037) grava snapshot JSONB completo em brand_archives ANTES
--      do delete; nada se perde, igual ao arquivo-morto de 11/ago.
--      TRAVA: se a duplicata tiver MAIS resultados que a marca mantida, o
--      script aborta com erro em vez de apagar — aí a direção da consolidação
--      precisa ser discutida, não executada.
--   3. Higiene de domínio: tira protocolo/www dos domínios SEM caminho
--      (www.polar.com → polar.com). Domínio com caminho (ex.: linktr.ee/...)
--      NÃO é tocado — esse é decisão manual (qualquer link do host contaria
--      como seu).
--
-- Como rodar: Supabase → projeto twhqjfbealruvcbvkegc → SQL Editor → colar
-- tudo → Run. Depois: anotar o brand_id impresso no passo 4 e setar
-- BACKFILL_MENTIONS_BRAND_ID=<esse id> no Railway (ultravis-server) e
-- redeployar — o boot reprocessa o histórico com o alias novo e o log avisa
-- quando terminar (aí remover a variável). É o mesmo fluxo de 10/ago.
-- ============================================================================

-- 0 · CONFERIR ANTES (leitura): quem são as duas e quanto cada uma tem
select b.id, b.name, b.aliases, b.is_active, b.created_at,
       (select count(*) from prompt_results r where r.brand_id = b.id) as results,
       (select count(*) from prompts p where p.brand_id = b.id)       as prompts
from brands b
where b.name in ('Polar Electro', 'Polar')
order by b.created_at;

-- 1..2 · ALIAS + DELETE COM TRAVA (transação única)
do $$
declare
  kept   brands%rowtype;
  dupe   brands%rowtype;
  kept_results  bigint;
  dupe_results  bigint;
begin
  -- exatamente uma "Polar Electro" (strict: 0 ou 2+ linhas = erro)
  select * into strict kept from brands where name = 'Polar Electro';

  -- duplicata na MESMA organização; se já não existe, só garante o alias
  select * into dupe from brands
   where name = 'Polar' and organization_id = kept.organization_id;

  -- 1 · alias (idempotente)
  if not ('Polar' = any(kept.aliases)) then
    update brands set aliases = array_append(aliases, 'Polar'),
                      updated_at = now()
     where id = kept.id;
    raise notice 'alias "Polar" adicionado a % (%)', kept.name, kept.id;
  else
    raise notice 'alias "Polar" já presente em % (%)', kept.name, kept.id;
  end if;

  if dupe.id is null then
    raise notice 'duplicata "Polar" não existe (já consolidada) — nada a apagar';
    return;
  end if;

  -- TRAVA de direção
  select count(*) into kept_results from prompt_results where brand_id = kept.id;
  select count(*) into dupe_results from prompt_results where brand_id = dupe.id;
  if dupe_results > kept_results then
    raise exception 'TRAVA: a duplicata "Polar" (%) tem % resultados > % da mantida "Polar Electro" — direção da consolidação precisa ser decidida, não executada. Nada foi apagado.',
      dupe.id, dupe_results, kept_results;
  end if;

  -- 2 · delete (o gatilho 00037 grava o snapshot em brand_archives antes)
  delete from brands where id = dupe.id;
  raise notice 'duplicata "Polar" (%) apagada com snapshot — % resultados arquivados junto',
    dupe.id, dupe_results;
end $$;

-- 3 · HIGIENE DE DOMÍNIO (só protocolo/www, nunca domínio com caminho)
update brand_domains
   set domain = regexp_replace(domain, '^(https?://)?(www\.)?', '')
 where domain ~ '^(https?://)?(www\.)?[^/]+$'
   and domain <> regexp_replace(domain, '^(https?://)?(www\.)?', '');

update competitors
   set domain = regexp_replace(domain, '^(https?://)?(www\.)?', '')
 where domain is not null
   and domain ~ '^(https?://)?(www\.)?[^/]+$'
   and domain <> regexp_replace(domain, '^(https?://)?(www\.)?', '');

-- 4 · CONFERIR DEPOIS — o id impresso aqui é o BACKFILL_MENTIONS_BRAND_ID
select b.id as backfill_mentions_brand_id, b.name, b.aliases,
       (select count(*) from prompt_results r where r.brand_id = b.id) as results
from brands b where b.name = 'Polar Electro';

-- snapshot da duplicata no arquivo-morto (deve aparecer 1 linha nova)
select brand_name, archived_at,
       jsonb_array_length(coalesce(payload->'prompt_results','[]'::jsonb)) as results_no_snapshot
from brand_archives where brand_name = 'Polar' order by archived_at desc limit 3;

-- domínios com caminho que sobraram (decisão manual, ex.: linktr.ee/...)
select 'brand_domains' as tabela, brand_id, domain from brand_domains where domain ~ '/'
union all
select 'competitors', brand_id, domain from competitors where domain ~ '/';
