# Índice de Citabilidade (IC) — framework Ultravis v1

> **Status:** framework aprovado e versionado (decisão "a" — 07/ago/2026).
> Fonte canônica dos pesos, dimensões e zonas. Qualquer implementação na
> plataforma (agent, página, cards) deve referenciar ESTE arquivo — se o
> framework evoluir, atualiza-se aqui primeiro e as superfícies depois.
>
> Referências (em `estrategia/referencias/`):
> `matriz-citabilidade.html` (matriz interativa original, "Olho de Tandera v1")
> e `curso-geo-joio-do-trigo.html` (curso autoral do Jhon — origem das
> táticas por dimensão e da âncora científica desta v1.1).

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

As categorias de fonte citadas abaixo são as do classificador da
plataforma (`web/src/lib/citations/classify.ts`): `you`, `competitor`,
`editorial`, `forum`, `social`, `review`, `institutional`, `other` —
o mesmo usado pela página Citações, pelo agent e pela página Citabilidade.

| Dim | Fonte de dado na plataforma | Régua v1 (0–100) |
|---|---|---|
| 01 Legibilidade | **Site Audit do domínio principal** (mesma fonte do headline da página Auditoria — `getAuditTrend`) | Score do audit mais recente do domínio principal |
| 02 Conteúdo | **Citações** categoria `you`: % das respostas de IA (todo o período) que citam o domínio próprio | Cobertura de citações owned; evolução futura: cruzar com cobertura de tópicos |
| 03 Social Presence | **Citações** categoria `social` (ex.: YouTube 19× no censo Datarisk) | % dos domínios sociais top-citados do setor onde a marca tem presença ativa |
| 04 Customer Reviews | **Citações** categorias `review` + `forum` (G2, Reclame Aqui, Reddit...) | % das plataformas de review citadas no setor onde a marca tem perfil reivindicado + avaliações recentes |
| 05 Open Media & AI Sources | **Citações** categorias `editorial` + `other` — o ranking real de domínios que as IAs citam nos prompts do cliente | % dos top-N domínios citados do setor em que a marca aparece (no censo Datarisk: exame, finsidersbrasil, ibgia.org, pwc, kpmg... Datarisk ausente do top 25 → score ~0) |
| 06 Verticals/Regulators | **Citações** categoria `institutional` + visibilidade por tópico em prompts de vertical | Presença nos prompts de categoria ("melhores empresas de X") + domínios institucionais do setor |

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

---

## 7. Os 4 verbos (v1.1 — colhido do curso GEO do autor)

O curso `referencias/curso-geo-joio-do-trigo.html` organiza GEO em **quatro
verbos** que são o *funil de citação* — a IA só cita quem ela consegue
**ler**, **entender** e **confiar**, e você só melhora o que **mede**. Isso
é o eixo pedagógico do IC (o "como funciona"), complementar às zonas (que são
o eixo de esforço/controle):

| Verbo | Pergunta | Dimensões IC | Táticas concretas (viram itens de ação nos cards/agent) |
|---|---|---|---|
| **01 LER** (acesso) | A máquina chega no seu conteúdo? | D1 | Checar Bing (ChatGPT usa o índice do Bing); liberar GPTBot no robots.txt; teste do view-source (texto crítico em HTML, não só JS); schema/JSON-LD; llms.txt (aposta barata) |
| **02 ENTENDER** (conteúdo) | O que você publica tem formato de resposta? | D2 | H2/H3 como a pergunta real por extenso + resposta nas 3 primeiras linhas; formato extraível (listas, tabelas, passos); comparativos "X ou Y" assinados; página pilar + subpáginas |
| **03 CONFIAR** (reputação) | O que os outros dizem sustenta a citação? | D3, D4, D5, D6 | Fluxo de reviews (5★ público / 1–4★ privado); menções earned (imprensa, podcasts, artigos); comunidades (Reddit/Quora com utilidade real); perfis oficiais + Wikipedia quando couber; backlinks naturais, não comprados |
| **04 MEDIR** (loop) | Você sabe se está funcionando? | o rastreamento | Frequência de citação (não resposta isolada); cadência semanal por mercado×idioma; mesmas perguntas do baseline; 1–2 ajustes por rodada |

### Âncora científica (dá credibilidade às recomendações)

Do paper **GEO — Generative Engine Optimization (Aggarwal et al., KDD 2024)**,
9 táticas × 10 mil consultas:

- **Aspas de fontes** (citação de quem sabe): **+41%** de visibilidade — a
  tática campeã.
- **Estatísticas com origem: +31%** · **Referências citáveis: +27%.**
- **Keyword stuffing: −8%** (piora) — o hábito do SEO antigo é o que menos serve.
- **Sites mal posicionados no Google são os que mais ganham** — a disputa
  recomeçou, e recomeçar favorece quem chegou depois (bom argumento de venda
  para o cliente que não é líder).

Usar esses números **no produto** (agent e cards) para justificar o "por quê"
de cada recomendação — não como garantia (o paper mede visibilidade em
benchmark, não venda), mas como bússola com fonte.

### Estilo de recomendação (colhido do curso — vira UX do agent)

Toda recomendação do agent/página deve seguir o padrão do curso: **"freio
cético" + "segunda de manhã"** — nomear o *limite honesto* da tática (o que
ela NÃO faz) e entregar *uma ação concreta* que cabe na segunda de manhã.
Tom honesto, anti-hype — é diferencial de marca (Joio do Trigo) e nos separa
do growth-speak dos concorrentes.
