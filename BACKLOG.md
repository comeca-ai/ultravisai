# BACKLOG — Ultravis

> Fila viva. **Atualizado: 10/set/2026.**
> Sessão = ajustes dos diretores + validar métricas. Sem migração D1.

## Como ler

- `P0` agora · `P1` próximo · `P2` estoque (não abrir)
- `[x]` some da P0/P1 na sessão seguinte

---

## ⛔ Não fazer

- Migrar Supabase → D1, dual-write, Hyperdrive, worker novo, “fase B/C”
- Fase 2 do ADR-9 · portar Ansvisor sem `DECISOES.md` · colar segredo em chat
- Reabrir item da ata marcado ✅
- Recolocar Autoridade/Acurácia no Score (4.1: saem até existir juiz LLM)

---

## P0 — sessão: diretores + métricas

Fontes, nesta ordem: ata · `ajustar.md` · regras MET-* · revisão 29/ago.

### A. Ajustes ainda abertos que os diretores pediram (código)

| # | Pedido | Fonte | O que fazer |
|---|---|---|---|
| A1 | **Uma conta de Score, não três** | DIV-04, ata 4.1/4.5, `ajustar.md` | Insights, Score e hero têm que contar a mesma coisa ou a tela tem que dizer por que não. Código, não slide novo. |
| A2 | Clique `#2,3` (Ranking médio) **não pode cair numa nota 45 sem explicação** | `ajustar.md` parte 1 | São escalas diferentes (média vs pódio). Texto na tela + destino do clique. |
| A3 | Vigia: **100% em 1º lugar** (amostra ≥10) = olhar o motor | ata 4.7 | Check em `consistency.js` |
| A4 | Auditoria: **rendering** (HTML cru vs renderizado) e **idioma/país** (`lang`/`hreflang`) | ata 4.10, checklist Igor | Completar 6/8 → 8/8 sinais |
| A5 | Citabilidade v2: **tela entrega o kit** (llms.txt, JSON-LD, FAQ) pra copiar | pedido ⭐ Polar, kit já no server | UI, não motor novo |
| A6 | Landing **não vender** 150 prompts × 4 motores se o código entrega 50 × 2 | DIV-01 | Copy ou gate — os dois têm que bater |

Não é desta sessão (⏳ sócio, não código): nome “citabilidade” (4.15),
acesso ADM do Igor (4.8), 9º motor (2.10), onboarding matriz (4.12 — dono
adiou), e-mail do Daily Pulse (2.8).

### B. Validar todas as métricas (prova, não opinião)

Para **cada** MET-01…MET-11 em `docs/regras-de-negocio-09set-v01.html`:

1. Ler a regra e o arquivo citado em `e:`.
2. Recalcular no SQL com Polar Electro (janela 30d, sem shopping).
3. Conferir o número na action e na tela.
4. Marcar **passa / falha / divergência** (ata diz X, código faz Y).

Entregar `docs/validacao-metricas-10set.html` (mesmo espírito de
`docs/verificacao-26ago.html`). Corrigir falha no mesmo PR quando for
bug. Divergência de desenho (DIV-05…14) vai pra tabela do relatório —
não “conserta” a ata.

Cuidado: **MET-10 está defasada.** Citação desde 09/set = link que traz
o produto, de qualquer fonte (`contarCitacoesDoProduto`, 00049) — não
“domínio próprio”. Validar o código + `DECISOES.md` 09/set.

Régua de sentimento 100/50/0 (ata 4.6) = **medir com Polar e reportar**,
não trocar sozinho.

---

## 📐 Reconciliação IC × Score — docs de lógica do Igor (17/ago)

> Fonte: `NewCo_Visao_Preliminar_Produto_e_Pacotes_v260817.xlsx` (4 abas) +
> `Ultravis_Citabilidade_Score_Reconciliacao_v20260817.pptx` (9 slides).
> Arquitetura definida: **dois índices que não se somam** — IC (alavanca,
> medido dos ATIVOS da marca) dirige o Score/Visibilidade (resultado, lido
> das respostas de IA). Tudo abaixo é o que AINDA NÃO EXISTE na plataforma.

### Decisões pendentes (travam o resto — bater o martelo com o Igor)
- [x] **Nomenclatura dos dois índices** — DECIDIDO 17/ago (registro): duas notas; tela atual renomeada "Índice de Citabilidade" (feito); página "Score de Visibilidade" na fila abaixo.
- [x] **Faixas de nota** — DECIDIDO 17/ago (registro): quintis 0-20/21-40/41-60/61-80/81-100 (feito).

### Réguas do IC por ATIVOS (planilha "Critérios de Nota" — exigem coleta nova)
- [ ] **D1 — sinais faltantes da lista do dono (18/ago)**: (a) **Rendering** — medir dependência de JavaScript comparando HTML cru vs renderizado (2 fetches; diz o que um bot de IA sem JS enxerga) `M`; (b) **Idioma/país** — sinal de `html lang` + `hreflang` + segmentação de país `P`; (c) **`<title>` descritivo** — presença/qualidade do title da aba por página (complementa H1 e meta description) `P`. Já cobertos: JSON-LD (3 sinais), FAQ/editorial, llms.txt, meta tags sociais (OG+Twitter), trust on-site + reputação externa via D4.
- [ ] **D1 estendida**: crawl de schema/llms.txt/sitemap + entidade (Wikidata/Wikipedia) + consistência nome/aliases — hoje o site audit cobre parte; mapear pros critérios da régua. `M`
- [ ] **D2 cobertura × qualidade GEO**: % dos tópicos com página própria × front-load/estatística com fonte/tabelas/blocos 50-150p/frescor <12m (LLM judge sobre o crawl). `M`
- [ ] **D3 checagem de canais sociais**: nº de plataformas ativas (satura em 5), cadência/recência, bônus YouTube. Exige leitura dos perfis (declarar o que não lemos). `M`
- [x] **D4 checagem direta de reviews** — FEITO 18/ago (PRs #66-#71): Trustpilot/G2/Capterra checados semanalmente via Scrape.do (cron `REVIEW_CHECK_CRON` + warm-up), régua v1 aplicada, card da tela mostra medição direta. Ficam pra frente:
  - [ ] **Reclame Aqui**: a API de busca deles devolve 502 até por proxy residencial — fica "não verificável" (declarado). Saída já implementada: mecanismo SERP via DataForSEO entra sozinho quando `DATAFORSEO_LOGIN`/`PASSWORD` forem configurados no worker Cloudflare (pendência do dono). `P`
  - [ ] Nota/volume do G2 e Capterra (páginas encontradas mas sem JSON-LD legível) — a SERP do DataForSEO também resolve. `P`
  - [ ] Google Reviews (API paga) + Reddit/Quora + lista por segmento via LLM (v1.1). `M`
- [ ] **D6 demanda de marca**: volume de busca da marca (DataForSEO — correlato r≈0,334), presença em listas "melhores/alternativas a", reguladores/associações, Wikipedia. `M`
- [ ] **Campo Evidência por dimensão** na tela (padrão do simulador da planilha: toda nota registra a fonte). `P`
- [ ] **Calibração com histórico**: regressão regularizada das dimensões do IC contra a Visibilidade observada — pesos deixam de ser prior e viram contribuição medida (slide 9, "fiz → melhorou"). `G` · depois de ~8 censos

### Score/Visibilidade (resultado) — índice novo com 6 dimensões próprias
- [ ] **Página "Score de Visibilidade"**: Citação 20% · Presença 20% · Autoridade 20% · Posição 15% · Acurácia 15% · Sentimento 10%, com réguas do slide 8. Presença/Sentimento já temos; Posição derivar da resposta. `M`
- [ ] **Autoridade** (profundidade do contexto quando citada) — LLM judge sobre as respostas. `M`
- [ ] **Acurácia** (alucinação sobre a marca) — LLM judge respostas × fatos da marca. `M`
- [ ] **Nível de citação** (não cita → cita → recomenda → lidera) por prompt×motor. `M`
- [ ] **Diagnóstico de gap 2×2 IC × Score** (slide 6: frágil/saudável/roadmap limpo/lag) — tela barata quando os dois índices existirem. `P`
- [ ] **Crosswalk alavanca → dimensão do Score** (aba "Ponte": quais ● cada alavanca move) como explicação na UI. `P`

### Pacotes e features comerciais (aba "Draft-Estrutura e Comparativo" — priorizar juntos)
- [ ] **Pacotes Sinal R$15k · Alcance R$20k · Domínio R$30k/mês** — página de pricing + gates por plano (frequência mensal/semanal/diária, 4/6/9 motores). `G` ⭐
- [ ] **9 motores de IA** (hoje ~6): completar com Grok, Copilot, DeepMind, Minimax. `M`
- [ ] **Alertas de variação de ±5 pontos** no score (e-mail/WhatsApp) — o Daily Pulse portado é a base; falta régua de ±5 e canal WhatsApp. `P` ⭐
- [ ] **"Fale com o Orin"** — agente ganhou nome; rename + posicionamento de suporte 24x7. `P`
- [ ] **Estimativa de potencial de retorno em vendas** (range + racional a partir do impacto em visibilidade). `M`
- [ ] **Rede de Conhecimento** — mapa visual de por onde as IAs passam (marca × concorrentes). `G`
- [ ] **Kit Press Release** — conteúdo de autoridade (headline, corpo, referência, canal). `M`
- [ ] **Briefing customizado até 100 prompts** (plano Domínio) + relatórios a partir de briefing. `M`
- [ ] **Relatório executivo C-level**. `P` (one-pager de 08/ago é o embrião)
- [ ] **Teste em tempo real** — digite uma pergunta e veja cada IA responder ao vivo. `M`
- [ ] **Concorrentes**: comparação das 6 dimensões com o líder do segmento · tabela técnica você vs concorrentes (JSON/Schema/llms.txt/FAQ) · comparativo de produtos com sentimento. `M`
- [ ] **Auditoria em 8 dimensões do site** (rendering, schema, FAQ/editorial, llms.txt, idioma/país, página de produto, meta tags sociais, trust) — mapear o site audit atual pras 8. `P`
- [ ] **Social GEO Score** + auditoria de presença em fontes citadas. `M`
- [ ] **Scan de comércio agêntico** (limitadores do site a agentes de compra; catálogo/preço marcados "futuro"). `G`
- [ ] **Priorização de problemas**: severidade (já temos no audit) + estimativa de impacto no score por problema + quick wins destacados. `M`
- [ ] **Plano de ação em sprints de 30 dias** + guia por responsável. `M`

## 🎨 Redesign "Insights v3" — mockup do dono (19/ago)

> Fonte: `estrategia/mockups/insights-v3-visual-19ago.html` (mockup completo,
> navegável no browser). Referência de design para a tela de Visibilidade;
> o rodapé do próprio mockup separa o que é DADO real do que é ILUSTRATIVO.
> Atenção: o mockup mostra 6 dimensões no Score — a decisão vigente (19/ago)
> é 4 dimensões até o juiz LLM; adotar o layout, não a composição.

### Componentes de dado (novos na tela)
- [ ] **Funil da citação**: execuções → respostas grounded (com fontes) → citam alguém do mercado → citam a marca, com % de conversão por etapa e leitura ("o gargalo não é a IA citar pouco; é você estar fora das fontes"). Requer marcar resposta como *grounded* e reusar o gabarito de mercado. `M` ⭐
- [ ] **Scatter Menção × Citação** (mapa competitivo): bolha por marca (tamanho = presença), quadrantes nomeados — narrativa emprestada / narrativa sua / invisível / crédito perdido; legenda com diagnóstico por marca. Dados já existem (menções, citações, presença). `M` ⭐
- [ ] **Heatmap Presença por engine** (marca × motor) com leitura do gap (ex.: ChatGPT/Copilot puxam do índice Bing). Dados já existem. `P`
- [ ] **Placar em barras com diagnóstico**: presença em barra + denominador na linha (12/54 prompts) + badge de quadrante no nome. Substitui o placar atual. `P`
- [ ] **Cards "Próxima ação"**: cada card nasce de um número da tela e aponta a alavanca do IC, com meta "de X → Y em 60d". Liga o Score (resultado) às alavancas (IC) na própria tela. `M` ⭐

### Conceitos de métrica (implicam coleta/derivação nova)
- [ ] **Resposta "grounded"**: flag por resposta (tem fontes/citações) — denominador da Taxa de Citação do mockup (12/462). Derivável do que já coletamos (citations não vazio). `P`
- [ ] **Denominadores visíveis em toda métrica** (na linha: 12/54, 12/462) — mesmo espírito da premissa "proporção ao total de prompts" anunciada pelo dono (aguardando detalhes). `P`
- [ ] **Multi-run por prompt** (painel "54 prompts × 6 engines × 3 runs"): rodar cada prompt N vezes por censo para reduzir variância. Multiplica custo de coleta ×N — decidir com números. `G`

### Design/visual (linguagem do mockup)
- [ ] Paleta clara quente (#F7F6F2 / accent #E0492A), IBM Plex Sans + JetBrains Mono para números, cards 14px radius, funil em card escuro de destaque. Avaliar adoção como tema da área de Insights (hoje usamos o design system do fork). `M`
- [ ] Barra de filtros persistente: período (24h/7d/30d/90d/Tudo) + tópicos + regiões + engines no topo da tela. `P`
- [ ] Rodapé de proveniência DADO × ILUSTRATIVO enquanto houver métrica provisória (padrão de honestidade que já usamos nos cards). `P`

## 🚀 Produto (features)

### P0 — Agora
- [x] **Merge do PR #2** — **obsoleto (10/set)**: zero PRs abertos na main; o trabalho daquele PR já está no ar. Não há o que mergear.
- [x] **Diálogo de confirmação antes de despachar scrapes** — confirmação antes do "Rodar Tudo" (aviso de crédito/irreversibilidade + nº de prompts ativos). `P` · protege caixa (lição do despacho acidental da Accenture, 264 scrapes)
- [x] **Alertas de variação** — **resolvido pelo Daily Pulse portado (13/ago)**: anomalias (queda brusca, surto de concorrente, prompt perdendo citação) + destaques, com cooldown de 7 dias. Falta só ligar o transporte de e-mail (decisão do e-mail dedicado) e a UI de Notificações.

### P1 — Próximo
- [ ] **Validar métricas MET-01…11 com Polar** — estático feito 10/set (`docs/validacao-metricas-10set.html`). Coluna Polar pendente: secrets do `verificar-censo` **ou** colar `supabase/scripts/validar-metricas-polar.sql` no SQL Editor. `P` · dono destrava
- [ ] **UI de aliases de marca** — campo em Settings/onboarding pros apelidos (backend pronto: migration 00036 + parser + backfill; hoje configura-se via banco). Sugerir alias automaticamente quando o nome tiver 2+ palavras. `P` · caso Polar Electro
- [ ] **Grader grátis sem login** — "qual sua citabilidade?" (reusa `describe-from-site` + 1 run enxuto + IC parcial). Funil de topo. `M` · `D3` · Onda 0
- [x] **Citabilidade v2 → Índice de Visibilidade (fase 1 entregue 15/ago)** — 6 dimensões sempre com nota, fórmula aberta, fontes pesquisadas visíveis, share de resposta com conferência, copiar llms.txt. Fase 2: blend cobertura de tópicos no D2, checagem direta de reviews (motor por segmento), prompts de marca (share direto), "o que a IA sabe/não sabe", fonte congelada. `M` · `D2` · Onda 1
- [ ] **Grounding de prompts em perguntas reais** — Semrush `phrase_questions` no onboarding/adicionar-marca (volume + intenção). `P` · `D4` · Onda 1
- [ ] **Money-prompts por intenção** — auto-etiquetar/priorizar prompts que compram (cadência por prompt; personas). `M` · `D2/D4` · Onda 1
- [ ] **Enriquecer D1/D5 com Ahrefs** — Domain Rating, backlinks, domínios que citam → tira dimensões do "não medido". `M` · `D2/D4` · Onda 1
- [ ] **Alinhar planos + Stripe** — código (49/249) × landing (390/1.290); pricing faixa R$690–990; `IS_CLOUD=true` só ao monetizar. `M` · `D3` · Onda 0/monetização
- [ ] **MCP Ultravis (diferencial)** — o servidor MCP + API v1 já existem (`web/src/app/api/mcp`, `.../api/v1`), autenticados por API key (`ans_`). **Feito:** rebrand pra `ultravis`; endpoint confirmado no ar (401 sem key); guia de conexão em `docs/MCP.md`. **Falta:** validar `tools/list` com key real, **posicionar como diferencial** (ferramenta plugável em qualquer IA) e conector Looker Studio apontando pra `ultravis.ai/api/v1`. `P` · `D2` · Onda 1

### P2 — Depois
- [ ] **Resumo Executivo (one-pager) na feature de Relatórios** — template novo que gera um one-pager pronto pro cliente (KPIs + visibilidade por plataforma + Share of Voice + Índice de Citabilidade + 3 recomendações). **Baixo esforço (~1–2 dias):** a feature de Relatórios + geração de PDF (`@react-pdf/renderer`, `/dashboard/reports`) e os dados já existem — é só um template. Validar antes o bug "relatório não gerado". Asset de venda/retenção. `P/M` · `D2/D3`
- [ ] **Atribuição citação → visita → lead** — evoluir a página de Tráfego de IA + GSC/GA4. A maior lacuna do mercado. `G` · `D5` · Onda 2
- [ ] **Card "Fontes que as IAs citam × você"** na página Citações (sketch, item d). `M`
- [ ] **Seção Metodologia na landing** (sketch, item b). `M`
- [ ] **Sync upstream seletivo** — pulses/alertas + integração GSC (estamos ~15 migrations atrás). `G`

### P3 — Algum dia
- [ ] **WhatsApp / Meta AI (Llama)** — avaliar se o Cloro raspa; canal que os globais ignoram. `M` · `D2` · Onda 3
- [ ] **Análise pt-BR profunda** — nuance de resposta + fontes locais. `M` · Onda 3
- [ ] ~~Execução agêntica / auto-publicação~~ — **NÃO fazer agora** (capital-intensivo, não é o wedge; ver roadmap §4)

---

## P1 — depois de A+B verde

1. UI de aliases (00036). Polar Electro.
2. Onboarding: Brazil → `pt`; ETA em tópicos; marca rascunho até o fim.
3. Gráfico escala (#14) — print do Igor.
4. MCP `tools/list` com key real.

---

## P2 — estoque

Insights v3, IC sinais extra, pacotes 15/20/30k, GSC/GA4, ADR-9 fase 2,
recontar citações (`aplicar=nao` primeiro).

---

## Decisões do dono (não inventar)

- Recalcular citações no histórico ou só daqui pra frente
- Pricing / `IS_CLOUD=true`
- DIV-02, DIV-03 e as 4 graves em `regras-de-negocio-09set-v01.html`
- Nota composta 0–100 na página Score (ata §pendência 6)

---

## Prompt pra colar no início da sessão

```
Leia CLAUDE.md, BACKLOG.md e estrategia/ata-decisoes-jhonata-igor.md.

Não migrar nada pra D1. Banco = Supabase.

Sessão:
1) Finalizar os ajustes que os diretores pediram nas reuniões
   (BACKLOG P0-A). Fonte = ata + ajustar.md. Não inventar pedido.
2) Validar todas as métricas criadas (MET-01…11): SQL → action → tela,
   Polar Electro. Entregar docs/validacao-metricas-10set.html.
   Falha de código = corrige no mesmo PR. Divergência de desenho = reporta.

Um PR por entrega. Feito → [x] no BACKLOG + linha no DECISOES.md.
Não reabrir ADR-9 fase 2. Não portar Ansvisor. Não recolocar
Autoridade/Acurácia no Score.
```
