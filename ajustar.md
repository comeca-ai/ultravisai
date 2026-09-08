# Ajustar — "Ranking médio" (Insights) × "Posição" (Score de Visibilidade)

> Levantamento de 07/set/2026. Os dois números saem da **mesma coluna**
> (`prompt_results.appearance_rank`) e mesmo assim não batem — nem deveriam,
> do jeito que estão hoje. Este arquivo separa o que é diferença legítima de
> desenho do que é inconsistência a corrigir.

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
> do Score — lá o cálculo é de pódio (1º=100 · 2º=60 · 3º=30 · 4º ou pior=0),
> então melhorar de 7º para 4º muda esta média e não muda aquela nota.

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

| #   | O quê                                       | Por quê primeiro                                             | Depende de |
| --- | ------------------------------------------- | ------------------------------------------------------------ | ---------- |
| 1   | Padrão do período `24h` → `30d`             | uma linha, e tira a tela vazia do caminho do cliente hoje    | nada       |
| 2   | Fallback pro último resultado + tarja       | é o que faz o produto parar de parecer quebrado entre censos | nada       |
| 3   | Score aceitar os mesmos filtros do Insights | é o único item que produz número divergente de verdade       | nada       |
| 4   | Tooltips explicando média × nota de pódio   | barato, e evita a conversa "seu número está errado"          | 3          |
| 5   | Igualar períodos (`24h`, `90d` no Score)    | fecha a comparação entre as duas telas                       | 3          |

Nenhum dos seis depende do deploy do servidor nem de credencial nova: são
tela e server action, sobem pela Vercel.

---

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

### Como virar nota 0–100

A média é ilimitada (pode dar #17) e "menor é melhor"; a nota precisa ser
0–100 e "maior é melhor". A conversão mais simples e defensável:

```
nota = 100 / ranking_médio
```

| Ranking médio | Nota |
| ------------- | ---- |
| 1,0           | 100  |
| 1,5           | 67   |
| 2,0           | 50   |
| 2,6           | 38   |
| 3,8           | 26   |
| 5,0           | 20   |

Decai suave, nunca chega a zero (aparecer em #20 vale mais que não aparecer,
o que está certo) e é a mesma curva que o mercado usa para posição em busca.

**Um detalhe que não pode ser trocado:** a média é calculada **primeiro** e a
nota depois — `100 / média(posições)`. Fazer o contrário (média das notas
`100/posição` de cada resposta) dá número diferente e não é o que a definição
diz. Exemplo com 2 respostas, #1 e #3: `100/média(1,3) = 100/2 = 50`, mas
`média(100/1, 100/3) = média(100, 33) = 67`. **A ordem correta é a primeira.**

### O que muda na prática

Retomando os exemplos da Parte 1, agora sob a regra nova:

**Exemplo A — a nota volta a se mexer.** 3×#1, 2×#2, 1×#3, 4×#7:

```
                    hoje (pódio)   com a regra nova
média 3,8    →      nota 45        nota 26
as de #7 vão pra #4:
média 2,6    →      nota 45        nota 38   ← agora acompanha
```

Era exatamente o defeito relatado: a marca melhorava e o Score não se mexia.

**Exemplo B — e o que se perde.** 5×#1 + 5×#3 versus 10×#2, ambos média 2,0:

```
                    hoje (pódio)   com a regra nova
5×#1 + 5×#3  →      nota 65        nota 50
10×#2        →      nota 60        nota 50   ← agora empatam
```

O pódio premiava a marca que às vezes é a primeira citada. A regra nova diz
que os dois perfis valem o mesmo. É consequência direta da definição — média
é média — e está registrada aqui para não virar surpresa depois.

### Onde mexer

| Arquivo                       | O quê                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| `visibility-index.ts:487-490` | somar `rankSum` e `rankCount` em vez de distribuir em `p1..p4`      |
| `visibility-index.ts:592-596` | nota = `100 / (rankSum / rankCount)`; `null` quando `rankCount = 0` |
| Score (tela)                  | exibir a média junto da nota — é o número que o cliente entende     |
| `messages/*.json`             | textos nos dois idiomas                                             |

A distribuição `#1/#2/#3/#4+` **continua sendo exibida** (é ótima para leitura
qualitativa); ela só deixa de ser a origem da nota.

Nenhuma migration: `appearance_rank` já tem tudo o que a fórmula precisa.
