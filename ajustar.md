# Ajustar — "Ranking médio" (Insights) × "Posição" (Score de Visibilidade)

> Levantamento de 07/set/2026. Os dois números saem da **mesma coluna**
> (`prompt_results.appearance_rank`) e mesmo assim não batem — nem deveriam,
> do jeito que estão hoje. Este arquivo separa o que é diferença legítima de
> desenho do que é inconsistência a corrigir.

## Índice

- **Parte 1** — Ranking médio × Posição: por que os dois números divergem
- **Parte 2** — Resumo de Visibilidade vazio entre censos
- **Parte 3** — As decisões técnicas: ranking, citação, pesos, validação do método
- **Parte 4** — Apresentação da auditoria (slide P3 do Igor)
- **Estado da implementação** — o que já está em código e o que ainda é só decisão (logo abaixo)

## Estado da implementação (atualizado 09/set)

Este arquivo mistura levantamento, decisão e implementação — nasceu de uma
conversa ao vivo, não de um plano escrito do zero. Pra não obrigar quem lê a
adivinhar o que já existe, o resumo:

| Decisão | Implementado? | Onde |
| --- | --- | --- |
| Ranking = Σ posições ÷ aparições | ✅ já era assim no Insights (nada mudou lá) | RPC `insights_aggregates` |
| Nota de Posição relativa ao campo (`appearance_rivals`), pódio fora | ✅ em produção | migration `00046`, `visibility-index.ts` (PR #154, mergeado 08/set) |
| Score e Insights lendo o mesmo RPC (resolve filtros/período/teto de 50k) | ✅ em produção | `visibility-index.ts` chama `insights_aggregates` diretamente |
| Pesos do Score 25% cada | ✅ em produção | `web/src/config/visibility-score.ts` |
| Padrão do período `24h` → `30d` | ✅ em produção | `insights/page.tsx:130` (PR #163, 08/set) |
| Resumo de Visibilidade cai pro último resultado + tarja | ✅ em produção | `fallbackTo` na action + tarja `fallbackBanner` (PR #163, 08/set) |
| Citação = link que traz o produto, de qualquer fonte | ✅ código pronto | migration `00049`, `response-parser.js`, `classify.ts`, script de recontagem |
| Sinais de sitemap e Product schema (slide do Igor) | ✅ código pronto | `signals/structure.js`, `rubric.json` (47 → 49), peças no `citability-kit.js` |
| "O QUE FAZER" no topo da auditoria, diagnóstico recolhido | ✅ código pronto | `audit-report.tsx` |

> Esta tabela ficou um dia inteira desatualizada (dizia ❌ pra dois itens que
> o PR #163 já tinha entregue) e alguém contou o trabalho errado por causa
> dela. Se você mexer em qualquer coisa deste arquivo, atualize a linha aqui
> no MESMO commit.

As 8 decisões estão implementadas. Cinco já rodam em produção; as três de
09/set (citação, sinais novos, "O QUE FAZER") entram no próximo deploy — as
de servidor pelo worker da Cloudflare, a da auditoria pela Vercel.

**Falta uma decisão sua**, e é a única coisa que segura a citação nova de
valer sobre o histórico: contar mais citações **sobe** o `visibility_score`.
Ou se recalcula o histórico e se assume o degrau no gráfico (com nota na tela
dizendo em que data a definição mudou), ou vale só daqui pra frente e a série
fica com duas réguas. O script `server/src/scripts/recontar-citacoes-produto.js`
nasce em SIMULAÇÃO: roda, mostra o que mudaria e lista uma amostra do que
passaria a contar, sem gravar nada. Rode, confira a amostra e só então
`CITACOES_APLICAR=1`.

---

## Onde cada número é calculado

|              | Ranking médio (Insights)                                       | Posição (Score de Visibilidade)                                    |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Origem       | RPC `insights_aggregates` (migration `00044`)                  | `getVisibilityIndex()` — `web/src/lib/actions/visibility-index.ts` |
| Conta        | `SUM(appearance_rank) / COUNT(*)` sobre `appearance_rank >= 1` | `(p1×100 + p2×60 + p3×30 + p4+×0) / total ranqueadas`              |
| Onde aparece | card "Ranking médio", `insights/page.tsx:1356`                 | dimensão Posição, `visibility-index.ts:595`                        |
| Escala       | **menor é melhor**, sem teto (#1, #2,3, #7…)                   | **maior é melhor**, 0–100                                          |

Os dois excluem `chatgpt-shopping` e os dois só contam respostas com
`appearance_rank >= 1` (a marca apareceu no texto e o rank foi calculado).
Até aí estão alinhados.

---

## Por que os números divergem

### 1. São escalas diferentes — e não são convertíveis

Isto é desenho, não bug. Mas é a causa nº 1 da confusão, porque o card
"Ranking médio" **leva direto pro `/dashboard/score`** (`onClick` em
`insights/page.tsx:1370`): a pessoa clica em `#2,3` e cai numa nota `45`, sem
nada na tela dizendo que uma coisa não vira a outra.

### 2. A nota trunca no 4º lugar; a média, não

Na nota, `4º`, `7º` e `20º` valem **todos zero**. Na média, pesam 4, 7 e 20.

**Exemplo A — a marca melhora e a nota não se mexe.**
10 respostas ranqueadas: 3×#1, 2×#2, 1×#3, 4×#7.

```
Ranking médio = (3×1 + 2×2 + 1×3 + 4×7) / 10 = 3,8
Nota Posição  = (3×100 + 2×60 + 1×30 + 4×0) / 10 = 45
```

Agora as quatro respostas de #7 melhoram para #4:

```
Ranking médio = (3 + 4 + 3 + 16) / 10 = 2,6   ← melhorou muito
Nota Posição  = (300 + 120 + 30 + 0) / 10 = 45 ← não mudou nada
```

**Exemplo B — mesma média, notas diferentes.**

```
Marca A: 5×#1 + 5×#3 → média 2,0 · nota 65
Marca B: 10×#2       → média 2,0 · nota 60
```

Nenhum dos dois está errado: a média pergunta _"em que posição você costuma
aparecer?"_, a nota pergunta _"quanto do pódio você captura?"_. O problema é
a tela não dizer isso.

### 3. Filtros: o Insights respeita, o Score ignora — **esta é a inconsistência séria**

O RPC do Insights aceita e aplica:

```
p_platform · p_models · p_region · p_prompt_id · p_topic_id · p_date_from/to
```

`getVisibilityIndex(brandId, preset)` aceita **só a marca e o preset**
(`visibility-index.ts:239`). A consulta filtra apenas
`brand_id` + `platform <> 'chatgpt-shopping'` + a janela em memória.

Consequência prática: **com qualquer filtro ativo no Insights, os dois números
passam a falar de populações diferentes** — e nada avisa. Filtrar por
"perplexity" muda o ranking médio e não muda a nota do Score.

### 4. Os períodos disponíveis não são os mesmos

|          | Períodos                                   |
| -------- | ------------------------------------------ |
| Insights | `24h`, `7d`, `30d`, `90d`, `all`, `custom` |
| Score    | `7d`, `30d`, `all` (default `30d`)         |

Quem olha o Insights em `90d` ou `24h` está comparando com um Score que só
sabe fazer 7/30/tudo. Não há tradução possível — o Score simplesmente cai no
preset dele.

### 5. A distribuição é agrupada de formas diferentes

O RPC devolve `rank_1, rank_2, rank_3, rank_4, rank_5, rank_gt5`; o Score
agrupa em `p1, p2, p3, p4+`. A tela do Insights soma `r4 + r5 + gt5` para
exibir, então **a distribuição bate**; só a média é que não.

---

## Ressalva que vale para os dois

`appearance_rank` conta **concorrentes cadastrados** (`competitors`), não
qualquer marca citada na resposta (`appearance-rank.js:60-69`). Marca com
poucos concorrentes cadastrados tende a `rank = 1` — o que infla os **dois**
indicadores ao mesmo tempo. Não causa divergência entre eles, mas afeta a
leitura absoluta: "somos os primeiros" pode significar "não cadastramos quem
aparece antes de nós".

Vale conferir a lista de concorrentes da Polar antes de usar qualquer um dos
dois números com o cliente.

---

## Como conferir na produção

Uma consulta, as duas contas, as mesmas linhas — se der diferente disto, é bug
de verdade e não diferença de definição:

```sql
select
  count(*) filter (where appearance_rank >= 1)                       as ranqueadas,
  round(avg(appearance_rank) filter (where appearance_rank >= 1), 1) as ranking_medio_insights,
  round(( count(*) filter (where appearance_rank = 1) * 100.0
        + count(*) filter (where appearance_rank = 2) *  60.0
        + count(*) filter (where appearance_rank = 3) *  30.0)
       / nullif(count(*) filter (where appearance_rank >= 1), 0), 0) as nota_posicao_score,
  count(*) filter (where appearance_rank is null)                    as pendentes_de_calculo
from prompt_results
where brand_id = '<BRAND_ID>'
  and platform <> 'chatgpt-shopping'
  and created_at >= now() - interval '30 days';
```

`pendentes_de_calculo > 0` é normal logo depois de um censo: a varredura de
enriquecimento roda a cada 30 min e essas linhas ficam fora dos dois números
até lá.

---

## O que ajustar

Em ordem de retorno pelo esforço.

> Esta lista P0-P3 é o primeiro corte, escrito antes das decisões técnicas
> da Parte 3. A tabela final e completa — com os 8 itens e o status real de
> cada um — está em "Ordem sugerida de execução", mais abaixo.

### P0 — Alinhar os filtros (é o único que produz número errado)

Hoje um filtro no Insights faz os dois números falarem de coisas diferentes
sem aviso. Duas saídas:

- **(a)** `getVisibilityIndex` passa a aceitar os mesmos filtros do RPC — é o
  certo, e é o que a pessoa espera ao navegar de uma tela pra outra;
- **(b)** enquanto (a) não existe, o card do Insights avisa no tooltip que a
  nota do Score ignora filtros.

Custo de (a): a consulta já lê `platform`; falta propagar `model_used`,
`region`, `prompt_id` e `topic_id` até a query e até a tela do Score.

### P1 — Dizer na tela que são escalas diferentes

O card "Ranking médio" leva ao Score. Deve dizer, no tooltip, algo como:

> Posição média em que a marca aparece no texto. **Não é** a nota de Posição
> do Score — lá o cálculo compara com o campo: quantos concorrentes foram
> citados na mesma resposta. O mesmo 3,3º vale nota bem diferente num campo
> de 3 concorrentes ou de 20 (ver "Como o Score reflete o ranking").

E o Score, no sentido inverso, deve exibir a **média** ao lado da nota. Custo:
i18n nos dois idiomas + um campo a mais no retorno do índice.

### P2 — Igualar os períodos

Somar `24h` e `90d` ao Score, ou tirar do Insights. Preferência: somar ao
Score — `90d` é o período em que a evolução aparece.

### P3 — ~~Decidir se o truncamento no 4º fica~~ → **DECIDIDO: o pódio sai**

Ver "Definição do ranking" logo abaixo. O truncamento em 4º deixa de existir;
a nota de Posição passa a derivar da média de posições.

---

## Resumo da Parte 1

Só um dos cinco itens é bug: **o Score ignora os filtros que o Insights
aplica**. Os outros quatro são a mesma falha de produto — duas perguntas
diferentes exibidas com o mesmo nome e ligadas por um clique, sem nada
explicando a diferença.

---

# Parte 2 — "Resumo de Visibilidade" precisa trazer o último resultado disponível

Levantado a pedido do dono na mesma sessão. **É o item mais grave deste
arquivo**, e não é sutil.

## O que acontece hoje

Três fatos que, juntos, produzem uma tela vazia pro cliente:

1. O período **padrão** do Insights é `24h`
   (`insights/page.tsx:128` — `datePreset: '24h'`);
2. O censo roda **uma vez por semana**, segunda 06:00 UTC
   (`DAILY_CRON_SCHEDULE = '0 6 * * 1'`);
3. Sem resultado na janela, a tela renderiza `<NoDataForPeriod>`
   (`insights/page.tsx:1329`) — "sem dados neste período, limpe os filtros".

Ou seja: **de terça a domingo, o cliente abre o produto e vê uma tela vazia**,
mesmo tendo dados coletados na segunda. O `hasAnyData` (`tracking.ts:669`)
salva só do caso extremo — ele impede o onboarding "rode seus prompts" de
aparecer pra quem já tem histórico —, mas não resolve o principal: o resumo
mostra nada em vez de mostrar o que existe.

Para o Igor, isso lê como produto quebrado. E não há como ele distinguir
"ainda não coletamos hoje" de "coletamos e você não apareceu em lugar nenhum"
— que é uma diferença enorme.

## O que fazer

**Regra:** o Resumo de Visibilidade nunca mostra vazio quando existe
resultado no histórico. Sem dados na janela, ele cai para a **última coleta
disponível** e diz, com todas as letras, de quando é.

Fluxo proposto:

```
resultado na janela escolhida?
  sim → mostra normal
  não → busca a data da última coleta (já temos: lastCheckedAt / MAX(created_at))
        → recarrega o resumo NAQUELE dia
        → mostra com tarja: "Última coleta: segunda, 07/set. O próximo censo
          roda na segunda que vem."
```

Três detalhes que fazem a diferença entre resolver e piorar:

- **A tarja é obrigatória.** Dado antigo mostrado como se fosse de hoje é pior
  que tela vazia — vira número errado numa reunião. Estado explícito:
  _"mostrando a última coleta (07/set)"_, com contraste suficiente pra não
  passar batido.
- **Comparações ficam suspensas no modo retroativo.** `visibilityChange`,
  `mentionsChange` etc. comparam com o período anterior; num fallback isso não
  significa nada. Devem sumir, não exibir `0%`.
- **`NoDataForPeriod` continua existindo** — para a marca que nunca coletou
  nada. O que muda é quando ele aparece: só quando o histórico está realmente
  vazio.

## Além disso: o padrão de `24h` está errado para este produto

Com censo semanal, `24h` acerta um dia em sete. O padrão deveria ser `30d`
(ou `7d`), que é a janela em que sempre existe pelo menos uma coleta. É uma
linha de código (`insights/page.tsx:128`) e resolve a maior parte dos casos
antes mesmo do fallback entrar em ação.

Sugestão: mudar o padrão **e** implementar o fallback. O padrão cobre o dia a
dia; o fallback cobre o cliente que filtrou `24h` na mão, e o período em que
o rastreamento estiver parado — como agora.

## Onde mexer

| Arquivo                    | O quê                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `insights/page.tsx:128`    | padrão `24h` → `30d`                                                                       |
| `insights/page.tsx:1329`   | `NoDataForPeriod` só quando `!hasAnyData`                                                  |
| `lib/actions/tracking.ts`  | retornar `fallbackTo` (data da última coleta) quando a janela vier vazia e o histórico não |
| `insights/page.tsx` (KPIs) | tarja de "dado retroativo" + esconder as variações                                         |
| `messages/*.json`          | textos da tarja nos dois idiomas                                                           |

Custo: pequeno. Nenhuma migration, nenhuma env, nenhuma dependência do deploy
do servidor — é tela e action, sobe pela Vercel.

---

# Ordem sugerida de execução

> Tabela reescrita em 08/set — a versão original listava 5 itens mas o texto
> abaixo dela falava em "sete primeiros" e "item 8": foi escrita antes das
> decisões maiores do arquivo (fórmula final do ranking, definição de
> citação, pesos 25%) e nunca foi atualizada com elas. Esta versão reflete
> as 8 decisões reais e o estado de cada uma — ver também "Estado da
> implementação" no topo do arquivo.

| # | O quê | Status | Por quê nesta ordem | Depende de |
| --- | --- | --- | --- | --- |
| 1 | Nota de Posição relativa ao campo, pódio fora | ✅ código pronto (PR #154) | corrige o teto artificial que a pergunta do dono expôs | nada |
| 2 | Score lendo o mesmo RPC do Insights | ✅ código pronto (PR #154) | é o que faz "ranking médio" e "nota de Posição" pararem de divergir | 1 |
| 3 | Pesos do Score 25% cada | ✅ código pronto (PR #154) | resolve de brinde a soma 65≠100 que ninguém conseguia ler | nada |
| 4 | Padrão do período `24h` → `30d` | ✅ em produção (PR #163) | uma linha, tira a tela vazia do caminho do cliente hoje | nada |
| 5 | Fallback pro último resultado + tarja | ✅ em produção (PR #163) | é o que faz o produto parar de parecer quebrado entre censos | nada |
| 6 | Citação = link que traz o produto, de qualquer fonte | ✅ código pronto (09/set) | hoje só conta domínio próprio; autoridade externa some do número | decisão sobre recálculo retroativo do `visibility_score` |
| 7 | Tooltips explicando posição relativa ao campo | ✅ código pronto (09/set) | evita a conversa "seu número está errado" | 1, 2 |
| 8 | Igualar períodos (`24h`, `90d` no Score) | ✅ código pronto (09/set) | fecha a comparação entre as duas telas | 2 |

Os itens 1-2-3 já estão implementados na branch `ajustar-analise` (PR #154,
draft) — faltam merge e o deploy do Cloudflare destravar pra chegarem em
produção. Os itens 4-5-7-8 são só tela e server action (Vercel, sem
depender do deploy do servidor). O item 6 toca o parser do servidor
(`response-parser.js`) e só chega em produção quando o deploy destravar.

---

---

# Parte 3 — As decisões técnicas (ranking, citação, pesos, validação)

As cinco seções abaixo nasceram de perguntas separadas na mesma sessão e
formam um bloco só: são as decisões que substituem o que a Parte 1
diagnosticou como divergência entre "ranking médio" e "nota de Posição".

## Definição do ranking — decisão do dono (07/set)

> "O ranking deve contabilizar o posicionamento da marca na quantidade de
> vezes que ela aparece. O ranking seria o somatório de posicionamento versus
> vezes que apareceu; se não aparece, não entra no count."

Formalizando:

```
ranking = Σ(posição em cada resposta onde a marca aparece)
          ─────────────────────────────────────────────────
          nº de respostas em que a marca apareceu
```

Resposta sem menção **não entra em lugar nenhum** — nem no numerador nem no
denominador. Nem "conta como último", nem "conta como zero": simplesmente não
existe para este indicador.

### O que isso muda em cada tela

**Insights — nada.** O "Ranking médio" de hoje já é exatamente isto:

```sql
SUM(appearance_rank) FILTER (WHERE appearance_rank >= 1)
  / COUNT(*)         FILTER (WHERE appearance_rank >= 1)
```

Ou seja, a métrica que o dono descreveu já está implementada e correta no
Insights. O problema nunca esteve aqui.

**Score — muda a fórmula.** A nota de Posição hoje é pódio ponderado
(`1º=100 · 2º=60 · 3º=30 · 4º+=0`, `visibility-index.ts:595`), que **não** é
"somatório de posicionamento ÷ vezes que apareceu". Precisa passar a derivar
da média.

### Como virar nota 0–100 — caminho percorrido, hoje SUPERADO por inteiro

> ⚠️ **Toda esta subseção foi substituída** — fórmula, exemplos numéricos E a
> tabela "onde mexer" que vinha com ela. `100 / média` ignora quantos
> concorrentes existem no campo: dava o mesmo número (30) pra um 3,3º lugar
> ruim (campo de 3) e um 3,3º lugar excelente (campo de 20), e travava
> qualquer marca sempre-segunda-colocada num teto de 50 pra sempre.
>
> A fórmula e a tabela "onde mexer" que valem de verdade — a que considera o
> tamanho do campo (`appearance_rivals`) e que está implementada — estão na
> seção "Como o Score reflete o ranking", mais abaixo. Fica só este resumo
> aqui como registro de que o caminho foi percorrido e por quê foi
> abandonado; não implemente nada a partir do que estava escrito nesta
> subseção antes.

---

## Definição de citação — decisão do dono (07/set)

> "A citação é a quantidade de vezes que ele trouxe seu link nos prompts
> avaliados. O link pode ser de outras fontes, mas tem que ter claramente o
> produto."

### O que o código faz hoje — e o buraco

`countOwnDomainCitations` (`response-parser.js:53-73`) conta **só links cujo
host é domínio da marca**. Qualquer outra fonte vale zero.

Consequência concreta: uma resposta do Perplexity que entrega ao usuário

```
https://www.techtudo.com.br/review/polar-vantage-v3-analise
```

conta **0 citações** para a Polar — mesmo a IA tendo colocado na mão do
cliente um link que fala do produto dela. Pela definição acima, isso é uma
citação. Hoje some do número.

Isso não é detalhe: citação é justamente onde a marca **não** controla a
página, e é por isso que vale como sinal de autoridade.

### A matéria-prima já existe

Cada citação guarda `url` **e** `title` (`web/src/types/index.ts:110-115`).
Ou seja, dá para decidir se o link "tem claramente o produto" **sem buscar a
página** — sem custo externo, sem latência, e retroativo sobre o histórico
inteiro, do mesmo jeito que o `appearance_rank` foi calculado para trás.

### Regra proposta

Uma citação conta para a marca quando **qualquer uma** for verdadeira:

1. o host é domínio da marca (o que já vale hoje); **ou**
2. um termo da marca aparece como palavra inteira no **título** da citação;
   **ou**
3. um termo da marca aparece no **caminho da URL** (slug), com os separadores
   normalizados (`polar-vantage-v3` → `polar vantage v3`).

Termos = nome + `aliases` (já existem na tabela `brands`) + nomes de produto.

### O risco que essa regra traz — e a proteção

"Polar" é palavra comum: _urso polar_, _região polar_, _vórtice polar_. A
regra 2/3 aplicada de forma ingênua transformaria uma matéria sobre clima em
citação da marca.

Proteções, em ordem de esforço:

- **Palavra inteira, sempre** (`\bpolar\b`) — já é o padrão do
  `response-parser.js`, é só espelhar;
- **Termo composto para marca de nome genérico**: exigir "Polar Electro",
  "Polar Vantage", "Polar Grit" em vez de "Polar" sozinho. Isso pede um campo
  novo por marca — algo como `citation_terms` — porque `aliases` hoje serve
  ao matching de menção, que tem tolerância diferente;
- **Amostragem manual antes de ligar**: rodar a regra sobre o histórico, listar
  as 50 citações que passariam a contar e conferir a olho. É barato e evita
  ligar um número inflado na frente do cliente.

### Separar as duas contagens, não somar

Citação no **próprio domínio** e citação em **fonte de terceiro** são coisas
diferentes para quem vai agir:

|                        | Significa                        | O que fazer                                       |
| ---------------------- | -------------------------------- | ------------------------------------------------- |
| Próprio domínio        | a IA foi buscar na sua página    | manter a página citável (é o kit de citabilidade) |
| Terceiro com o produto | alguém falou de você e a IA usou | assessoria, review, presença em comparativos      |

Somar as duas num número só apaga essa diferença. Recomendo `citation_count`
(total, como o dono definiu) **mais** a quebra própria × terceiro na tela.

### Dois efeitos colaterais que precisam de decisão

**1. O `visibility_score` muda.** `citation_count` entra no cálculo
(`response-parser.js:175-179`: `min(citationCount × 15, 30)` e mais um bônus
proporcional). Contar mais citações **sobe** o score histórico. Duas saídas:

- recalcular retroativamente e assumir o degrau no gráfico (com nota na tela
  dizendo em que data a definição mudou); **ou**
- valer só daqui pra frente, aceitando que a série fica com duas definições —
  pior, na minha leitura: um gráfico com duas réguas engana mais do que um
  degrau explicado.

**2. Duas superfícies precisam concordar.** O próprio código avisa
(`response-parser.js:27-32`): `citation_count` é gravado na escrita, mas a
página de Citações reclassifica **na leitura**
(`web/src/lib/citations/classify.ts`). Se a regra nova entrar só de um lado,
a mesma métrica passa a mostrar números diferentes em telas diferentes — que
é exatamente o problema da Parte 1 deste arquivo, repetido.

### Onde mexer

| Arquivo                                | O quê                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `server/src/lib/response-parser.js:53` | `countOwnDomainCitations` → `countProductCitations` (host **ou** título **ou** slug) |
| `web/src/lib/citations/classify.ts`    | mesma regra na leitura — as duas superfícies têm que bater                           |
| `brands` (migration)                   | `citation_terms` para marca de nome genérico                                         |
| Script de recálculo                    | reprocessar o histórico, no molde do `appearance-rank`                               |
| Tela de Citações                       | quebra própria × terceiro                                                            |

---

## Pesos do Score de Visibilidade — decisão do dono (07/set)

> "Os pesos passam a ser divididos por igual, cada um com 25% para o Score de
> Visibilidade."

São quatro dimensões — Citação, Presença, Posição e Sentimento — então
4 × 25% = 100%.

### O que está lá hoje

`web/src/config/visibility-score.ts:35-40`:

| Dimensão   | Peso bruto | Peso **efetivo** hoje |
| ---------- | ---------- | --------------------- |
| Citação    | 20         | 30,8%                 |
| Presença   | 20         | 30,8%                 |
| Posição    | 15         | 23,1%                 |
| Sentimento | 10         | 15,4%                 |
| **Soma**   | **65**     | 100%                  |

Repare: **os pesos brutos somam 65, não 100.** A tela renormaliza na hora de
calcular (`score/page.tsx:104` — `weight / totalWeight`), então o número
exibido está certo, mas ninguém consegue ler os pesos do registro e prever o
resultado. Sobra de um desenho que previa Autoridade e Acurácia, que nunca
foram implementadas.

Essa foi, aliás, a origem do bug corrigido em 29/ago: a fórmula impressa na
tela usava os pesos brutos e não fechava com o valor exibido
(`0,20×31 + 0,20×48 + 0,15×57 + 0,10×64 = 30,75 ≠ 47`).

**Com 25% cada, o problema desaparece na origem:** os pesos somam 100 e a
renormalização vira identidade.

### O que muda no número

Com as notas do exemplo acima (citação 31, presença 48, posição 57,
sentimento 64):

```
hoje:          (20×31 + 20×48 + 15×57 + 10×64) / 65 = 47,3  → 47
25% cada:      (31 + 48 + 57 + 64) / 4               = 50,0  → 50
```

A direção do efeito é sempre a mesma: **Sentimento sobe muito** (15,4% → 25%)
e **Citação e Presença perdem** (30,8% → 25%). Marca com sentimento bom e
citação fraca ganha; o inverso perde.

Vale saber o que se está escolhendo: hoje o Score diz que ser citado importa
o dobro de ser bem falado. Com pesos iguais, passam a valer o mesmo. É uma
decisão de produto legítima — só não é neutra, e por isso fica escrita.

### A renormalização continua existindo (e agora fica trivial)

Quando a marca nunca apareceu, Posição e Sentimento vêm `null` e são
excluídas do cálculo. Com pesos iguais isso vira simplesmente **a média
aritmética das dimensões medidas** — 2 dimensões medidas = 50% cada, e assim
por diante. Muito mais fácil de explicar ao cliente do que a conta de hoje.

### Onde mexer

| Arquivo                                    | O quê                                                                |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `web/src/config/visibility-score.ts:35-40` | os quatro `weight` para `25`                                         |
| `score/page.tsx` (fórmula impressa)        | continua correta; com soma 100 ela passa a bater sem o `≈`           |
| Tela                                       | dizer "todas as dimensões pesam igual" onde hoje há a lista de pesos |

Uma linha de configuração. Não há migration nem dependência do deploy do
servidor — os pesos do **Score de Visibilidade** vivem em arquivo, não na
tabela `index_weights` (essa é do Índice de Citabilidade, que tem seis
dimensões e **não** é afetado por esta decisão).

---

## Como o Score reflete o ranking — e a correção da proposta anterior

> "Como os pesos devem se comportar para que o Score de Visibilidade também
> seja reflexo do ranking, na direção correta? O melhor ranking é 3,3, mas no
> score ele pode ser no máximo 1. Como ajustar isso ou separar os conceitos?"

### Primeiro: os pesos não são a alavanca

A pergunta chega como "peso", mas o problema não está lá. Com 25% para
Posição, a dimensão já tem espaço suficiente para mover o Score. O que impede
o Score de refletir o ranking é a **conversão** de posição em nota.

Mexer no peso para compensar uma conversão ruim mascara o defeito e estraga
as outras três dimensões junto.

### Correção: minha proposta de `100 / média` estava errada

Registrei antes neste arquivo `nota = 100 / ranking_médio`. Está errada, e o
motivo é exatamente o que a pergunta aponta.

`100 / 3,3 = 30`. Mas **3,3 entre 3 concorrentes é ruim e 3,3 entre 20 é
excelente** — e a fórmula dá 30 nos dois casos. Pior: uma marca sempre
segunda colocada fica presa em 50, para sempre, sem jeito de melhorar a não
ser sendo primeira em tudo. O teto vira uma parede.

### O dado que resolve já existe e nunca foi usado

A migration `00043` grava, junto do `appearance_rank`, a coluna
**`appearance_rivals`** — quantos concorrentes apareceram naquela resposta
(`appearance-rank.js:69,132`).

**Ela nunca é lida por ninguém.** Nem pelo Insights, nem pelo Score. É
justamente o denominador que falta.

### A conversão correta: posição relativa ao campo

Por resposta:

```
nota = (rivais + 1 − posição) / rivais × 100
```

Ficar em 1º entre 3 concorrentes = 100. Ficar em último = 0. E o mesmo 3,3
passa a valer coisas diferentes conforme o tamanho do campo — que é a
realidade:

| Posição média | Concorrentes no campo | Nota |
| ------------- | --------------------- | ---- |
| 3,3           | 3                     | 23   |
| 3,3           | 5                     | 54   |
| 3,3           | 10                    | 77   |
| 3,3           | 20                    | 88   |

Compare com `100 / média`, que devolveria **30 em todos os quatro casos**.

### Uma inversão de ordem em relação ao que escrevi antes

Para o **ranking exibido** (Insights) a regra do dono continua valendo como
está: soma as posições, divide pelas aparições, pronto.

Para a **nota do Score** a ordem se inverte: calcula a nota **por resposta**
(cada uma com o seu próprio número de rivais) e só então tira a média das
notas. Não dá para normalizar depois, porque o tamanho do campo muda de
resposta para resposta.

São duas agregações diferentes porque respondem a duas perguntas diferentes —
e é por isso que os dois números não precisam ser iguais.

### Caso de borda: nenhum concorrente citado (`rivais = 0`)

A marca aparece sozinha. A posição é 1 por definição, e não há campo para
normalizar. Recomendo **nota 100**: a IA citou você e mais ninguém, que é o
melhor resultado possível. Mas a tela deve mostrar quantas respostas foram
assim — "em N de M respostas nenhum concorrente foi citado" —, porque 100
obtido sem adversário é frágil e some no dia em que um concorrente entrar.

### Então: separar ou unir os conceitos?

**Unir o dado, separar a apresentação.** Não são duas métricas, é a mesma
medida vista de dois ângulos:

|                   | Insights                            | Score                       |
| ----------------- | ----------------------------------- | --------------------------- |
| Mostra            | `Ranking médio 3,3`                 | `Posição 77/100`            |
| Responde          | "em que lugar eu costumo aparecer?" | "quanto do campo eu ganho?" |
| Direção           | menor é melhor                      | maior é melhor              |
| Considera o campo | não (número absoluto)               | sim (relativo aos rivais)   |

E a tela do Score mostra **os dois juntos**, com uma linha ligando:

> Posição **77/100** — você aparece em média em **3,3º**, num campo de
> **10 concorrentes** citados.

Assim o cliente vê o número que entende (3,3) e o número que entra na conta
(77), e a relação entre eles fica explícita em vez de virar suspeita.

### O que muda em "onde mexer"

Substitui o que registrei na seção da definição do ranking:

| Arquivo                         | O quê                                                                    |
| ------------------------------- | ------------------------------------------------------------------------ |
| `visibility-index.ts:524`       | somar `appearance_rivals` ao `select` — hoje nem é lido                  |
| `visibility-index.ts:487-490`   | nota por resposta `(rivals+1−rank)/rivals×100`; acumular soma e contagem |
| `visibility-index.ts:592-596`   | nota da dimensão = média das notas por resposta                          |
| `visibility-index.ts` (retorno) | devolver também a média de posições e a média de rivais, pra tela        |
| Score (tela)                    | a frase que liga os dois números                                         |

Nenhuma migration: a coluna existe desde 00043 e já está populada.

---

## Validação: o método é o mesmo? — **Não é. Hoje nem existe dos dois lados.**

> "A conta para o ranking do item 3 do Score de Visibilidade precisa bater com
> o ranking médio da tela principal. Valide que o método é o mesmo."

Validei condição por condição, comparando a CTE `filtered` do RPC
(`00044_insights_summary_v2.sql:31-46`) com a consulta e a agregação em
memória do Score (`visibility-index.ts:520-534` e `:486-491`).

| #   | Condição                                 | Insights                        | Score                        | Batem?                 |
| --- | ---------------------------------------- | ------------------------------- | ---------------------------- | ---------------------- |
| 1   | Marca                                    | `brand_id = p_brand_id`         | `.eq('brand_id', …)`         | ✅                     |
| 2   | Exclui `chatgpt-shopping`                | sim                             | sim                          | ✅                     |
| 3   | Linhas que entram                        | `appearance_rank >= 1`          | `rank >= 1`                  | ✅                     |
| 4   | Rank pendente (`null`)                   | fora                            | fora                         | ✅                     |
| 5   | Rank `0` (não computável)                | fora                            | fora                         | ✅                     |
| 6   | Filtro motor/modelo/região/prompt/tópico | **aplica**                      | **ignora**                   | ❌                     |
| 7   | Data inicial                             | `>= p_date_from` (`24h…custom`) | `>= from` (`7d/30d/all`)     | ❌ na prática          |
| 8   | Data final                               | suporta (`p_date_to`)           | **não existe**               | ❌ em intervalo custom |
| 9   | Teto de linhas                           | sem teto                        | **50 000** (`SCAN_MAX_ROWS`) | ❌ acima disso         |
| 10  | **A conta em si**                        | `SUM(rank) / COUNT(rank)`       | **não calcula média**        | ❌                     |

**A linha 10 é a resposta direta:** o Score **não tem** ranking médio. Ele só
distribui as respostas em `p1/p2/p3/p4+` e transforma isso na nota de pódio.
Não há uma média para comparar com a da tela principal — por isso os dois
"não batem": um existe e o outro não.

E mesmo implementando a fórmula idêntica no Score, as linhas 6 a 9 fariam os
números divergirem em uso normal: basta o cliente filtrar por um motor, ou
escolher `90d`, para as duas telas falarem de populações diferentes.

### O jeito de garantir que batem — e não é disciplina

Escrever a mesma fórmula duas vezes (uma em SQL, outra em TypeScript) é
convite à divergência: a primeira mudança que entrar de um lado só já quebra
o acordo, e ninguém percebe até um cliente reclamar.

**Uma fonte só:** o Score passa a ler `rank_sum` e `rank_count` do **mesmo
RPC** `insights_aggregates`, com os **mesmos argumentos** que a tela de
Insights usa. Aí "o método é o mesmo" deixa de ser promessa e vira identidade
— não há como divergir, porque é literalmente a mesma consulta.

Isso resolve de uma vez as linhas 6, 7, 8, 9 e 10 da tabela.

### Para a nota relativa ao campo, estender o mesmo RPC

A nota que considera o tamanho do campo precisa de `appearance_rivals` por
resposta, que o RPC hoje não devolve. Em vez de o Score ir buscar as linhas
por fora (o que reabriria a divergência), **a conta desce para o mesmo RPC**:

```sql
-- somar ao bloco `totals` do insights_aggregates
COALESCE(SUM(
  CASE
    WHEN appearance_rank >= 1 AND appearance_rivals >= 1
      THEN (appearance_rivals + 1 - appearance_rank)::numeric
           / appearance_rivals * 100
    WHEN appearance_rank >= 1                     -- sozinha no texto
      THEN 100
  END
) FILTER (WHERE appearance_rank >= 1), 0)                AS pos_score_sum,
COUNT(*) FILTER (WHERE appearance_rank >= 1
                   AND appearance_rivals = 0)            AS pos_sem_rival
```

E aí:

- **ranking exibido** = `rank_sum / rank_count` — o mesmo número nas duas telas;
- **nota da dimensão** = `pos_score_sum / rank_count`;
- **transparência** = `pos_sem_rival` diz em quantas respostas a marca estava
  sozinha, que é o número que impede o "100" de enganar.

Os três saem da **mesma linha de código**, sobre as **mesmas linhas do banco**,
com os **mesmos filtros**. Impossível divergirem.

### Teste que prova a igualdade

Depois de implementar, isto tem que dar zero. Roda sobre a produção, sem
alterar nada:

```sql
-- ranking médio calculado pelas duas rotas sobre a mesma janela
with pelo_rpc as (
  select (insights_aggregates('<BRAND_ID>'::uuid, null, null, null,
                              now() - interval '30 days', now(), null, null)
         ->>'rank_avg')::numeric as valor
),
na_mao as (
  select round(avg(appearance_rank)::numeric, 1) as valor
  from prompt_results
  where brand_id = '<BRAND_ID>'
    and platform <> 'chatgpt-shopping'
    and appearance_rank >= 1
    and created_at >= now() - interval '30 days'
)
select pelo_rpc.valor as rpc, na_mao.valor as manual,
       pelo_rpc.valor - na_mao.valor as diferenca
from pelo_rpc, na_mao;
```

`diferenca <> 0` significa que alguma das dez condições da tabela acima voltou
a divergir. Vale virar teste de CI com uma marca de referência, para a
próxima mudança no RPC não desfazer isto em silêncio.

> Ajuste na assinatura: o RPC precisa passar a devolver `rank_avg` pronto (é
> `rank_sum / rank_count` arredondado) em vez de deixar cada consumidor
> dividir por conta própria — mesmo motivo: divisão duplicada é divergência
> esperando acontecer.

---

# Parte 4 — Como apresentar o resultado da auditoria (slide P3 do Igor)

O slide define o formato da entrega, não só o conteúdo:

> "O mais importante é que o cliente tenha claro **o quê** e **onde ele deve
> começar atuando**." — em função dos prompts a otimizar e baseado no
> resultado da varredura, índices e score.

E a estrutura pedida tem dois blocos:

- **Legibilidade** (apenas do site e conteúdo da marca) — 9 itens;
- **Conteúdo** — "está ok, apenas recomendar onde publicar".

## Como a auditoria de hoje se compara aos 9 itens

| Item do slide                           | Sinal na auditoria                                  | Peça no kit (#152)           | Situação                                 |
| --------------------------------------- | --------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| Schema.org                              | `json-ld-presence` · `json-ld-validity`             | JSON-LD de organização       | ✅                                       |
| JSON-LD                                 | `json-ld-relevance`                                 | JSON-LD de organização e FAQ | ✅                                       |
| LLM.txt                                 | `llms-txt-presence`                                 | `llms.txt` pronto            | ✅                                       |
| **Product**                             | —                                                   | —                            | ❌ **não existe**                        |
| **Sitemap**                             | —                                                   | —                            | ❌ **não existe**                        |
| Wikidata/Wikipedia                      | `brand-entity` (consulta Wikidata)                  | —                            | ⚠️ diagnostica, não entrega              |
| Página de produto sem título descritivo | `h1-quality` · `meta-description`                   | bloco de meta tags           | ⚠️ parcial — não é específico de produto |
| meta tags sociais                       | `open-graph` · `twitter-card`                       | bloco de meta tags           | ✅                                       |
| Trust/reputação                         | `privacy-terms` · `contact-info` · `press-mentions` | —                            | ⚠️ diagnostica, não entrega              |

Dos 9, **5 estão cobertos ponta a ponta**, 2 diagnosticam sem entregar e
**2 não existem**: `Product` e `Sitemap`. Nenhum dos 47 sinais olha para o
sitemap — nem se existe, nem se está no `robots.txt`, nem se cobre as páginas
de produto.

## O que falta implementar

**Dois sinais novos** (aditivos, no molde dos existentes):

- `sitemap-presence` — busca `/sitemap.xml` e a diretiva `Sitemap:` no
  `robots.txt`. O `fetcher.js` já sabe buscar arquivo auxiliar (é o mesmo
  caminho do `llms.txt`), então é barato;
- `product-schema` — para página de produto, verifica JSON-LD do tipo
  `Product` com `name`, `offers` e `aggregateRating`. É o schema que os
  motores usam para montar comparativo — e é o que separa "a IA sabe que
  existe" de "a IA sabe o preço e a nota".

**Duas peças novas no kit**, para os itens que hoje só diagnosticam:

- JSON-LD de `Product` pronto, montado do que a página já tem;
- bloco de `sitemap` no `robots.txt`, na mesma linha da liberação dos bots.

## A mudança de apresentação — que é o pedido central

Hoje o relatório lista **47 sinais** por categoria técnica (Estrutura,
Conteúdo, Autoridade, E-E-A-T, Confiança). É uma boa organização para quem
audita e a errada para quem vai **agir**: o cliente lê 47 linhas e não sabe
por onde começar.

O slide pede o inverso — abrir por **"O QUE FAZER"**, com o diagnóstico
disponível abaixo para quem quiser conferir:

```
O QUE FAZER

  LEGIBILIDADE          ← só site e conteúdo da marca
    ▸ 3 itens a corrigir, com o arquivo pronto pra colar
    ▸ 2 itens a corrigir, sem peça automática

  CONTEÚDO
    ▸ onde publicar     ← derivado dos prompts a otimizar

  ————————————————————
  Diagnóstico completo (47 sinais)   [recolhido]
```

Duas regras de ordenação que o slide implica:

1. **Ordem por onde começar**, não por categoria. O primeiro item da lista
   tem de ser o de maior impacto ainda não resolvido — e "impacto" já existe
   na rubrica como `impactTier`.
2. **Só o que falta aparece no topo.** Sinal que passa não é ação; desce para
   o diagnóstico. Hoje passa e falha convivem na mesma lista.

O bloco "Conteúdo" fecha o laço que o slide desenha com a seta: as
recomendações de onde publicar saem **dos prompts a otimizar**, não da página
auditada. É a ligação entre a auditoria (uma página) e o rastreamento (os
prompts) — hoje as duas telas não conversam.

## Onde mexer

| Arquivo                                     | O quê                                        |
| ------------------------------------------- | -------------------------------------------- |
| `server/src/lib/audit/signals/structure.js` | sinal `sitemap-presence`                     |
| `server/src/lib/audit/signals/structure.js` | sinal `product-schema`                       |
| `server/src/lib/audit/rubric.json`          | os dois sinais novos (47 → 49)               |
| `server/src/lib/audit/citability-kit.js`    | peças de `Product` e de sitemap              |
| `web/src/components/audit/audit-report.tsx` | "O QUE FAZER" no topo; diagnóstico recolhido |
| `messages/*.json`                           | textos nos dois idiomas                      |

Os dois sinais e as duas peças tocam o servidor — só chegam em produção com
o deploy destravado. A reordenação da tela é web e sobe pela Vercel.
