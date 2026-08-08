# Ultravis — Tese estratégica e agenda de pesquisa profunda

> Consolida a discussão estratégica da fase de lançamento num só lugar e,
> principalmente, formula as **perguntas de pesquisa profunda** — os pontos
> onde hoje decidimos por convicção, sem dado duro. Serve de briefing para
> quem for pesquisar.
>
> Documentos irmãos (detalhe): `benchmarking-competitivo.md`,
> `roadmap-produto-e-valuation.md`, `indice-citabilidade.md`,
> `fontes-externas-e-grounding.md`. Estado geral: `../CONTEXTO.md`.
>
> **Última atualização:** 08/ago/2026

---

## 1. Tese em uma frase

As pessoas estão trocando a busca no Google por perguntas à IA. A Ultravis
**mede** se a marca aparece nessas respostas e **diz o que fazer** para
aparecer mais — e o "o que fazer" (o **Índice de Citabilidade**) é o que
nenhum concorrente, nacional ou global, produtizou.

## 2. O wedge: Índice de Citabilidade (IC)

- Framework de 6 dimensões com **gabarito setorial** e plano de ação
  sequenciado. Detalhe em `indice-citabilidade.md`.
- Espinha didática vem dos **4 verbos** (Ler, Entender, Confiar, Medir) do
  curso de GEO; ancoragem científica no paper (Aggarwal et al., KDD 2024):
  citar fontes +41%, estatísticas +31%, referências +27%.
- **Por que é o wedge:** todo mundo mede visibilidade; ninguém entrega o
  *manual de como subir*. É o que vira "medição" em "produto acionável".

## 3. Posicionamento e concorrência (estado atual da leitura)

- **"BR-first" sozinho não é mais diferencial** — já há players brasileiros
  reais, cada um num flanco: **Promptado** (preço baixo, ~R$399),
  **First Answer** (capital de VC), **naia** (WhatsApp), **Teia**
  (governança).
- **Não competir por preço.** Faixa de entrada preliminar **R$690–990**,
  ancorada no valor do IC, não no custo.
- O diferencial defensável é a combinação **IC acionável + dado local +
  atribuição** — não o idioma.

## 4. Roadmap × valuation (4 ondas — resumo)

| Onda | O quê | Tese de valor |
|---|---|---|
| 0 — table stakes | Alertas de variação, grader grátis, planos+Stripe | Vira ferramenta de uso contínuo (retenção) |
| 1 — diferencial | Citabilidade v2, grounding de prompts reais | O wedge que ninguém tem |
| 2 — atribuição | Citação → visita → lead → receita | A maior lacuna do mercado; sustenta múltiplo maior |
| 3 — moat | WhatsApp/Meta AI, dado proprietário BR | Canal que os globais ignoram |

Decisões já batidas: **não** perseguir execução agêntica/auto-publicação
agora (capital-intensivo, não é o wedge); **não** brigar por preço.

## 5. Ideia em aberto: citabilidade por produto × persona

Marcas de consumo lançam produtos o tempo todo, para públicos distintos.
Hoje todo mundo mede citabilidade **da marca inteira**. Cruzar a resposta da
LLM com fontes externas (Ahrefs/Semrush/GSC) para medir **por produto e por
persona** é um ângulo que nenhum concorrente explora. Ainda **não validado**
— vira pergunta de pesquisa (§6, Q5).

---

## 6. Agenda de pesquisa profunda (onde falta dado duro)

> Para cada pergunta: **hipótese** (o que achamos hoje), **o que provar** e
> **onde olhar**. O objetivo é converter convicção em evidência — ou
> derrubar a convicção antes de investir nela.

### Q1 — Tamanho e velocidade do mercado BR de AEO/GEO
- **Hipótese:** existe demanda crescente de marcas BR preocupadas com
  visibilidade em IA, mas ainda cedo (early market).
- **Provar:** TAM/SAM aproximado; volume de busca por termos como "aparecer
  no ChatGPT / no Gemini"; nº de agências BR já vendendo GEO; orçamento
  típico. Curva de adoção (estamos no "innovators" ou já "early adopters"?).
- **Onde:** Semrush/Ahrefs (volume BR), LinkedIn (agências/vagas "GEO/AEO"),
  Google Trends, relatórios de martech BR.

### Q2 — Teardown feature-a-feature dos 4 concorrentes BR
- **Hipótese:** nenhum produtizou um índice acionável com gabarito.
- **Provar:** o que Promptado, First Answer, naia e Teia **de fato medem** e
  **entregam** (só score? plano de ação? por marca ou por prompt?); tiers e
  preços reais; superfícies cobertas. Confirmar (ou furar) a alegação
  "ninguém tem o IC".
- **Onde:** sites/trials dos produtos, demos, reviews, posts dos fundadores,
  Crunchbase (First Answer funding).

### Q3 — Atribuição citação → visita → lead é viável hoje?
- **Hipótese:** é a maior lacuna do mercado **e** é tecnicamente possível.
- **Provar:** GA4/GSC já expõem tráfego de referral de IA? Dá para detectar
  referrers de ChatGPT/Perplexity/Copilot de forma confiável em 2026? Qual a
  cobertura real (muitos vêm sem referrer)? Se não for viável, a Onda 2 é
  mais frágil do que assumimos.
- **Onde:** docs GA4/GSC, estudos de "AI referral traffic", experimentos
  próprios no tráfego da ultravis.ai, fóruns de analytics.

### Q4 — Willingness-to-pay na faixa R$690–990
- **Hipótese:** marca mid-market BR paga ~R$800/mês pelo valor do IC.
- **Provar:** benchmark de preço de ferramentas adjacentes no BR (Semrush BR,
  brand monitoring, SEO tools); quanto agências cobram por GEO; sensibilidade
  a preço em entrevistas com 5–10 prospects.
- **Onde:** tabelas de preço públicas, entrevistas com prospects, propostas
  de agências.

### Q5 — Demanda pelo ângulo produto × persona
- **Hipótese:** marcas de consumo querem saber se **o produto** (não só a
  marca) é citado, por persona.
- **Provar:** existe dor declarada? Algum tool global segmenta por
  produto/persona (Profound, Peec, etc.)? É white space real ou nicho?
- **Onde:** entrevistas com marcas de consumo, teardown de tools globais,
  comunidades de marketing.

### Q6 — A ciência do GEO ainda se sustenta?
- **Hipótese:** os efeitos do paper (citar fontes +41% etc.) continuam
  válidos com os modelos de 2026.
- **Provar:** há estudos mais recentes? O efeito se manteve conforme os
  modelos mudaram? O IC repousa nesses números — vale um refresh de
  literatura.
- **Onde:** Google Scholar / arXiv (GEO, AEO, LLM citation), papers pós-KDD
  2024, blogs de pesquisa das labs.

### Q7 — Cobertura de superfícies BR (WhatsApp / Meta AI)
- **Hipótese:** WhatsApp/Meta AI é um canal que os globais ignoram e que
  pesa no BR.
- **Provar:** o Cloro raspa Meta AI? O Meta AI já responde a perguntas de
  marca no BR em volume relevante? Vale a Onda 3?
- **Onde:** capacidades do Cloro, testes manuais no WhatsApp/Meta AI BR,
  dados de uso de IA no Brasil.

### Q8 — Defensibilidade contra um global localizando pro BR
- **Hipótese:** nosso moat é IC + dado local + relacionamento, não o idioma.
- **Provar:** se um Profound/Peec (ou o First Answer, com capital) localizar
  pra pt-BR, o que nos protege? Honestamente mapear o fosso.
- **Onde:** análise de barreiras (dado proprietário, switching cost,
  distribuição), casos de defesa de incumbentes locais vs. entrantes globais.

---

## 7. Lições do piloto Datarisk (o que o primeiro cliente real ensinou)

- **O fluxo funciona ponta-a-ponta** com marca real (35 prompts × 7
  plataformas, concorrentes reais). Deixou de ser demo.
- **O onboarding com IA é o momento mágico** — "preencher a partir do site"
  tira o cliente da folha em branco.
- **Medição só vale se for honesta** — puxou o IC parcial (mostrar só o que
  mede).
- **Cloro cobra no clique e é irreversível** — disparo acidental queimou 264
  scrapes → motivou o P0 de confirmação.
- **Free-tier/quota estoura no meio do run** e deploy mata run em polling →
  motivou o modo webhook.
- **Erro de "provider" às vezes é bug de banco** — ler o log real antes de
  culpar a LLM.
- **Pendente:** consolidar os 245 scrapes do censo (já no banco) em
  `../BUSINESS-CASE-DADOS.md` — é o que vira prova de venda.

---

## 8. Como usar este doc

1. Quem for fazer as **pesquisas profundas** começa pela §6 (uma pergunta por
   vez; anexar fontes e conclusão embaixo de cada Q, ou em arquivo próprio em
   `referencias/`).
2. Conclusões que mudem rota voltam pro `roadmap-produto-e-valuation.md` e pro
   `../BACKLOG.md`.
3. Este arquivo é vivo — atualizar a data no topo a cada rodada.
