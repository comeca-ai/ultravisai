# Índice de Citabilidade (IC) — framework Ultravis v1

> **Status:** framework aprovado e versionado (decisão "a" — 07/ago/2026).
> Fonte canônica dos pesos, dimensões e zonas. Qualquer implementação na
> plataforma (agent, página, cards) deve referenciar ESTE arquivo — se o
> framework evoluir, atualiza-se aqui primeiro e as superfícies depois.
>
> Visualização de referência: `referencia-matriz-citabilidade.html`
> (matriz interativa original, "Olho de Tandera v1").

---

## 1. O que o IC responde

**"Quão citável a marca é pelas IAs — e qual a próxima alavanca a puxar?"**

O rastreamento (Cloro) mede o *resultado*: onde a marca aparece nas
respostas. O IC organiza as *causas*: as 6 frentes de trabalho que fazem
uma marca ser citada, com peso relativo, e um mapa de esforço
(controle próprio ↔ dependência de terceiros) que ordena a execução.

É o par natural do dashboard: Visibilidade = placar; Citabilidade = plano.

## 2. As 6 dimensões (pesos somam 100)

| # | Dimensão | Ação-título | O que mede | Frente | Peso | Zona |
|---|---|---|---|---|---|---|
| 01 | **Legibilidade do Site** | Deixe o site legível para as IAs | Prontidão técnica e entidade — schema/JSON-LD, llms.txt, Wikidata | Site próprio | **15%** | A |
| 02 | **Conteúdo** | Responda cada pergunta no seu site | Cobertura + qualidade GEO por tópico — página própria e extraível | Site próprio | **20%** | A |
| 03 | **Social Presence** | Ocupe os canais e publique recente | Pegada multiplataforma e frescor — 4+ plataformas, YouTube | Redes sociais | **12%** | B |
| 04 | **Customer Reviews** | Domine as plataformas de review | Prova social e voz do cliente — G2, Trustpilot, Reclame Aqui, Reddit | Voz dos clientes | **18%** | B |
| 05 | **Open Media & AI Sources** | Apareça nas fontes que as IAs citam | Mídia earned, editorial, diretórios e listagens do setor | Mídia e PR | **22%** | C |
| 06 | **Verticals/Segments/Regulators** | Seja referência na sua vertical | Autoridade de segmento — reguladores, associações, demanda de marca | Segmento | **13%** | C |

Numeração `01–06` segue a ordem de execução (matriz v1.1); a coluna
"old" do HTML original preserva a numeração da v1.0 (04, 02, 06, 03, 01, 05).

## 3. As 3 zonas de ação

A matriz posiciona cada dimensão por **onde a alavanca vive** (interno ↔
externo) × **quanto depende de terceiros**. Disso saem três zonas com
linguagem de ação própria:

| Zona | Nome | Cor | Semântica | Dimensões |
|---|---|---|---|---|
| **A** | **Faça agora** | azul `#2a78d6` | Você controla, é rápido — site e conteúdo próprios | 01, 02 (35% do IC) |
| **B** | **Reivindique** | laranja `#eb6834` | É de terceiros, mas você ativa — reivindicar perfis, pedir reviews, publicar | 03, 04 (30% do IC) |
| **C** | **Conquiste** | verde `#1baf7a` | Depende de terceiros, é lento — earned media, autoridade de vertical | 05, 06 (35% do IC) |

Regras de leitura da matriz:

- **Bolha = peso no IC**; posição = esforço/controle. A zona "se é seu,
  você controla" (interno + alta dependência) é **vazia por definição**.
- Ordem de execução recomendada: **A → B → C**. A zona A destrava as
  demais (IA só cita quem consegue ler); a C é onde está o maior peso
  isolado (D5, 22%), mas colher exige que A e B estejam de pé.
- A zona B é o "meio acionável": retorno médio, esforço baixo — reviews e
  social são de terceiros, mas a ativação é sua.

## 4. Réguas de score (0–100 por dimensão)

Score da marca = `Σ (score_dimensão × peso)`. Réguas propostas por
dimensão, mapeadas ao que a plataforma **já mede** — nada aqui exige
fonte de dado nova para a v1:

| Dim | Fonte de dado na plataforma | Régua v1 (0–100) |
|---|---|---|
| 01 Legibilidade | **Site Audit** (categorias técnicas: schema, estrutura, extraibilidade) | Score técnico do audit da home/páginas-chave |
| 02 Conteúdo | **Site Audit** (categorias de conteúdo) + cobertura: % de tópicos rastreados com página própria citável | Média ponderada audit-conteúdo × cobertura de tópicos |
| 03 Social Presence | **Citações** tipo `social` extraídas dos resultados + presença nos canais citados pelo setor (ex.: YouTube 19× no censo Datarisk) | % dos domínios sociais top-citados do setor onde a marca tem presença ativa |
| 04 Customer Reviews | **Citações** tipo `review`/`forum` (G2, Reclame Aqui, Reddit...) | % das plataformas de review citadas no setor onde a marca tem perfil reivindicado + avaliações recentes |
| 05 Open Media & AI Sources | **Citações** tipo `news`/`external` — o ranking real de domínios que as IAs citam nos prompts do cliente | % dos top-N domínios citados do setor em que a marca aparece (no censo Datarisk: exame, finsidersbrasil, ibgia.org, pwc, kpmg... Datarisk ausente do top 25 → score ~0) |
| 06 Verticals/Regulators | **Visibilidade por tópico** em prompts de vertical + citações de domínios de associação/regulador | Presença nos prompts de categoria ("melhores empresas de X") + domínios institucionais do setor |

O insight-chave da v1: **as citações extraídas pelo rastreamento são o
"gabarito" das zonas B e C** — em vez de auditar a internet inteira, o IC
compara a marca contra a lista real de fontes que as IAs citam nos
prompts daquele cliente. É defensável, específico do setor e já está no
banco.

## 5. Adoção na plataforma (decisões de 07/ago/2026)

| Item | Superfície | Decisão |
|---|---|---|
| (a) Framework versionado no repo | este arquivo | ✅ **feito agora** |
| (c) Framework no AI Agent | `web/src/lib/agent/citability-framework.ts` (bloco aditivo no system prompt) | ✅ **em seguida** — agent passa a estruturar recomendações por dimensão/zona |
| (E) Página Citabilidade | dashboard, seção Analytics, após "Visibilidade" (badge NOVO) | ✅ **autorizada** — hero com score, matriz interativa, plano de ação por zona |
| (b) Seção Metodologia na landing | landing `/` | ⏳ aguardando decisão |
| (d) Card "Fontes que as IAs citam × você" | página Citações | ⏳ aguardando decisão |

Princípios de implementação (anti-drift do fork):

- Tudo **aditivo**: arquivo novo, rota nova, componente novo. O core de
  rastreamento não muda.
- O IC **consome** dados existentes (site audit, citações, visibilidade);
  não cria pipeline novo de coleta na v1.
- i18n obrigatório (pt-BR + en) em qualquer superfície nova.

## 6. Vocabulário (usar consistentemente em UI, agent e relatórios)

- **Índice de Citabilidade (IC)** — o score 0–100 da marca.
- **Dimensão / alavanca** — cada uma das 6 frentes.
- **Zonas: "Faça agora" (A) · "Reivindique" (B) · "Conquiste" (C)** —
  sempre com estes verbos; são a linguagem de ação do produto.
- Em inglês: *Citability Index*; zonas *Act now / Claim / Earn*.
