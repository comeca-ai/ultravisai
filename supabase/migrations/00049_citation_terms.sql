-- 00049_citation_terms.sql
-- Ultravis (camada do fork) — termos que fazem um link de terceiro contar
-- como citação da marca.
--
-- Decisão do dono (07/set, registrada em ajustar.md Parte 3):
--
--   "A citação é a quantidade de vezes que ele trouxe seu link nos prompts
--    avaliados. O link pode ser de outras fontes, mas tem que ter claramente
--    o produto."
--
-- Até aqui só contava link no domínio próprio. Uma resposta do Perplexity que
-- entrega ao usuário `techtudo.com.br/review/polar-vantage-v3-analise` contava
-- ZERO citações pra Polar — justamente o caso em que a marca não controla a
-- página, que é o que dá valor de autoridade ao sinal.
--
-- Por que uma coluna nova em vez de reusar `aliases`: alias serve ao matching
-- de MENÇÃO no texto, com tolerância própria. Marca de nome comum precisa de
-- termo COMPOSTO só na citação — "Polar Vantage", "Polar Grit" — senão uma
-- matéria sobre vórtice polar entra na conta. Misturar os dois usos numa
-- coluna só forçaria uma das duas regras a ceder.
--
-- Vazio é o normal: sem termos aqui, o parser usa nome + aliases da marca.
-- Preencher é o que uma marca de nome genérico faz pra apertar a regra.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS citation_terms text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.brands.citation_terms IS
  'Termos que fazem um link de terceiro contar como citação da marca (palavra inteira, no título ou no slug). Vazio = usa nome + aliases. Existe pra marca de nome comum, que precisa de termo composto.';
