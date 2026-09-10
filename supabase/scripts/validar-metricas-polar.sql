-- Validação MET-01…11 com Polar Electro (janela 30d).
-- Colar no SQL Editor do projeto twhqjfbealruvcbvkegc.
-- Não imprime texto de resposta — só agregados.

-- 1. Marca
select id, name, aliases, citation_terms, is_active
from public.brands
where name ilike '%polar electro%';

-- 2. Presença / menções / citações / ranking (MET-06, 08, ranking)
-- Troque o uuid se o select 1 não for Polar Electro.
with polar as (
  select id from public.brands
  where name ilike '%polar electro%'
  order by created_at
  limit 1
)
select
  count(*) as respostas,
  count(*) filter (where mention_count > 0) as com_mencao,
  round(
    100.0 * count(*) filter (where mention_count > 0) / nullif(count(*), 0),
    1
  ) as presenca_pct,
  coalesce(sum(mention_count), 0) as mencoes,
  coalesce(sum(citation_count), 0) as citacoes,
  round(avg(appearance_rank) filter (where appearance_rank >= 1)::numeric, 2) as ranking_medio,
  count(*) filter (where appearance_rank = 1) as rank_1,
  count(*) filter (where appearance_rank = 2) as rank_2,
  count(*) filter (where appearance_rank = 3) as rank_3,
  count(*) filter (where appearance_rank >= 4) as rank_4mais
from public.prompt_results r
join polar p on p.id = r.brand_id
where r.platform <> 'chatgpt-shopping'
  and r.created_at >= now() - interval '30 days';

-- 3. Sentimento só com menção (MET-07)
with polar as (
  select id from public.brands
  where name ilike '%polar electro%'
  order by created_at
  limit 1
)
select
  count(*) filter (where sentiment = 'positive') as pos,
  count(*) filter (where sentiment = 'neutral')  as neu,
  count(*) filter (where sentiment = 'negative') as neg,
  round(
    (
      100.0 * count(*) filter (where sentiment = 'positive')
      + 50.0 * count(*) filter (where sentiment = 'neutral')
    ) / nullif(count(*), 0),
    1
  ) as nota_sentimento
from public.prompt_results r
join polar p on p.id = r.brand_id
where r.platform <> 'chatgpt-shopping'
  and r.mention_count > 0
  and r.created_at >= now() - interval '30 days';

-- 4. SoV menções (MET-08) — RPC oficial (marca vs concorrentes na mesma resposta)
select public.share_of_voice_aggregates(
  (select id from public.brands where name ilike '%polar electro%' order by created_at limit 1),
  null, null, null,
  now() - interval '30 days',
  now(),
  null, null
);

-- 5. Pesos do IC (MET-01 / MET-02)
select dim_key, weight
from public.index_weights
order by dim_key;
