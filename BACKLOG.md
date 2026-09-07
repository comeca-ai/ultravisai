# BACKLOG — Ultravis

> Backlog operacional vivo, priorizado. Destila `estrategia/roadmap-produto-e-valuation.md`,
> o benchmarking e as pendências do `CONTEXTO.md` em itens acionáveis.
> Atualizar conforme entrega/decisão. **Última atualização:** 07/set/2026 (pós-migração Cloudflare — envs agora vivem no worker `ultravis-server`, não mais no Railway).

## Como ler

- **Prioridade:** `P0` agora · `P1` próximo · `P2` depois · `P3` algum dia
- **Esforço:** `P` pequeno (horas–1 dia) · `M` médio (dias) · `G` grande (semanas)
- **Driver:** de valuation — `D2` diferenciação · `D3` tração · `D4` dados · `D5` ROI
  (ver `estrategia/roadmap-produto-e-valuation.md` §2)
- **Onda:** a qual onda do roadmap pertence

---

## 🧲 Funil (novidades de concorrentes — priorizar JUNTOS, sem prioridade até decidirmos)

> Alimentado pelo vigia do upstream (card no `/ops`, varre site + GitHub a cada
> 3 dias) + varreduras manuais. Cada item leva a tag da origem. Nada aqui entra
> em desenvolvimento sem decisão conjunta registrada no `DECISOES.md`.
> **Última varredura:** 13/ago/2026 — release 0.2.0 do upstream (09/ago) + commits até 13/ago.

- [x] **Watchdog: check de drift de deploy do web** (feito 17/ago; falta só configurar VERCEL_TOKEN/PROJECT_ID no worker Cloudflare) — comparar o commit do último deploy de produção da Vercel com o HEAD da `main` (API Vercel pelo server, que tem egress aberto); alertar se divergir por mais de 1h. Motivo: web ficou 9 dias congelado sem ninguém notar (incidente 17/ago). `P1`
- [x] `[ansvisor]` **Daily Pulse** — **lado servidor PORTADO (13/ago)**: engine+metrics+email+webhook-dispatch com todos os fixes (#654 catch-up adaptado pra tabela `jobs`, #690 drain do pulse, #701 dedupe por janela — migration 00038 aplicada). E-mail sai por Resend OU pelo SMTP do watchdog (self-host incluído); sem transporte configurado, dispara só o webhook `daily_pulse.created`. **Follow-ups:** tela Configurações→Notificações (frequência/destinatários) e tradução do e-mail pra pt-BR **antes de ligar o envio**.
- [ ] `[ansvisor]` **AI Visibility Score** — nova métrica central 0-100 (60% menção · 25% citação · 15% posição da menção), idêntica em todas as superfícies; cobertura vira linha secundária. *Nosso ângulo: responde exatamente a confusão do cliente com a nota; mas muda migrations/core (00041-00042) — sync grande.*
- [ ] `[ansvisor]` **Integração Google Search Console** — sugestões de prompt alimentadas por demanda real de busca (queries que a marca ranqueia e não rastreia), via Composio. *Nosso ângulo: casa com "grounding de prompts" do P1; nós usaríamos Semrush ou GSC direto.*
- [ ] `[ansvisor]` **Integração GA4** (pós-0.2.0, #695/#703) — conexão GA por marca. *Nosso ângulo: alimenta a "atribuição citação→visita→lead" (P2, a grande lacuna).*
- [x] `[ansvisor]` **Leva de confiabilidade do tracking** — **PORTADO (13/ago)** após estudo do código deles: fantasmas do Cloro (#690), dois orçamentos de drain (#710), leitura paginada (#716), stall 10→25min configurável (#649), TRACKING_CONCURRENCY. Não aplicável ao fork: guarda de run parcial/#583 (exigem o ledger tracking_runs que não temos). 6 envs novas documentadas no .env.example.
- [ ] `[ansvisor]` **Citações: página de detalhe por URL** — cada URL citada abre as respostas que a citaram + breakdown por prompt. *Nosso ângulo: aprofunda a página de Citações que já reformulamos.*
- [ ] `[ansvisor]` **Fan-out coverage por prompt** — mostra quantas respostas dispararam busca viva (`12/500 · 2%`). *Nosso ângulo: item #16 do feedback (falhas visíveis por prompt) tangencia isso.*
- [ ] `[ansvisor]` **OpenRouter como provider / sentimento provider-agnostic** (#708). *Nosso ângulo: reduziria dependência da chave OpenAI (causa do incidente de domingo).*
- [ ] `[ansvisor]` **Range selector 7/30/90d + sort padrão por visibilidade em Prompts** (#697/#714). *Nosso ângulo: quick-win de UX, cherry-pick fácil.*
- [ ] `[ansvisor]` **robots.txt com allowances explícitas pra AI crawlers + sitemap** (#634). *Nosso ângulo: já fizemos o nosso; comparar abordagens.*

*Contexto de distância do fork: upstream está na migration 00052; nossa base upstream para na 00033 (+ nossas 00034-00037 próprias). Atenção: os números 00034+ deles colidem com os nossos — sync exige renumeração.*

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
- [ ] **Merge do PR #2** — trabalho acumulado na branch (logout, login Google, Citabilidade 5–8, Citações PT, Custos admin, curso/estratégia, migration 00035). `P` · housekeeping
- [x] **Diálogo de confirmação antes de despachar scrapes** — confirmação antes do "Rodar Tudo" (aviso de crédito/irreversibilidade + nº de prompts ativos). `P` · protege caixa (lição do despacho acidental da Accenture, 264 scrapes)
- [x] **Alertas de variação** — **resolvido pelo Daily Pulse portado (13/ago)**: anomalias (queda brusca, surto de concorrente, prompt perdendo citação) + destaques, com cooldown de 7 dias. Falta só ligar o transporte de e-mail (decisão do e-mail dedicado) e a UI de Notificações.

### P1 — Próximo
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

## 🐞 Bugs & qualidade

### P0 — Achados do Q&A do site público (crítico)
- [x] **Landing bloqueada pra buscadores/bots de IA** (`robots Disallow: /` + `noindex` global, herdado do upstream) — **corrigido**: landing indexável, app noindex escopado, robots + sitemap.
- [x] **Termos & Privacidade → 404 (risco LGPD)** — **resolvido (11/ago)**: páginas publicadas em versão preliminar genérica (sem razão social, com aviso de revisão interna), pt-BR + en, indexáveis e no sitemap. Pendência futura: texto final aprovado internamente + revisão jurídica.
- [x] **Rodapé com links mortos** — **resolvido (11/ago)**: colunas mortas removidas da landing; Termos/Privacidade apontam pras páginas reais; link do GitHub upstream removido. Colunas voltam conforme as páginas existirem.

### P1 — Achados do Q&A #2 (11/ago, reprodução do onboarding)
- [x] **"Preencher com IA" lia a home errada** — o path digitado era descartado (`polar.com/br` → lia `polar.com` global), gerando descrição genérica. **Corrigido**: path preservado no describe-from-site. Nota: o mecanismo SEMPRE leu o site real (cheerio: title/meta/headings/parágrafos) — não era "conhecimento do modelo".
- [ ] **Monitorar operação por subpath** — a aba Domínios só aceita domínio raiz; não dá pra monitorar `polar.com/br` especificamente (citações contam por hostname). Requer decisão de produto (domínio+path nas citações). `M`
- [ ] **Região → idioma no wizard** — default vem `US/en`; escolher Brazil deveria puxar `pt` automaticamente. `P`
- [ ] **Sugerir tópicos sem feedback de progresso** — ~55s com 3 mensagens sequenciais, sem barra/ETA; parece travado (provável causa da percepção de bug no onboarding do cliente, além da janela do 401). Adicionar progresso/ETA e investigar timeout. `P/M`
- [ ] **Marca criada no 1º "Continuar"** — o wizard persiste a marca antes de terminar; teste abandonado deixa marca ativa órfã (risco de crédito no censo). Criar como rascunho ou limpar ao abandonar. `M`
- [ ] **Insumo pro Citabilidade v2**: o próprio polar.com/br não tem `llms.txt` (404) nem JSON-LD — evidência perfeita do valor dos snippets prontos (#15). `—`

### P1
- [x] **i18n páginas restantes** — **feito (13/ago)**: mutirão de 9 agentes cobriu Tráfego, detalhe de Prompt, Fan-out, Tópicos, gestão de marca (990 linhas), breakdown do Insights, componentes de Configurações, PDF do relatório (via labels) e resquícios em 10 páginas (incl. o "Product Tour"). ~570 chaves novas por locale; 1.821 chaves espelhadas pt-BR/en. Resta: resquícios internos da tabela All Prompts (aria/empty states) e strings geradas no servidor (rootCause, briefs) — anotar como P2.
- [ ] **Cache da landing no CDN** — HTML servido por SSR serverless a cada visita (TTFB ~0,6s, custo e latência à toa numa página estática). Avaliar `revalidate`/headers de cache. `P` · perf (Q&A)
- [ ] **4 bugs do docx:**
  - [x] Login sem mensagem "conta já existe" — **feito** (PR #38)
  - [x] "Rodando como Ansvisor" (#28) — **feito (12/ago)**: agente do produto se apresentava como Ansvisor, arquivos exportados chamavam `ansvisor_*.csv/pdf`, `/pricing` redirecionava pro site do UPSTREAM, mailto sales@ansvisor.com, links pro repo upstream — tudo trocado por Ultravis. Restam os templates de e-mail do Supabase (painel — verificar com o dono).
  - [x] Tela de login travando (#29) — causa mais provável (OAuth Site URL=localhost) já corrigida; **melhorias (12/ago)**: form honra `?redirectTo` do middleware (destino pós-login não se perde). Reverificar com o cliente.
  - [x] Relatório não gerado (#30) — **feito (12/ago)**: o resumo executivo por IA abortava o relatório inteiro se falhasse (tabela `reports` tinha ZERO linhas na história; a tentativa do cliente caiu na janela da chave morta). Resumo agora é não-fatal: relatório salva sem prosa e as telas/PDF escondem a seção vazia.
  - [ ] #14 gráfico com escala errada — aguarda print do cliente
- ✅ ~~Site URL = localhost:3000~~ — **resolvido** nesta sessão (config de OAuth do Google)

---

## 🔧 Operacional & infra

### P0 — pós-migração Cloudflare (ADR-9, 06/set)
- [ ] **Consolidação Polar** — script pronto (`supabase/scripts/consolidar-polar.sql`, decisão 29/ago); **bloqueado só em acesso**: conector Supabase precisa alcançar o projeto de produção (`twhqjfbealruvcbvkegc`) OU dono roda no SQL Editor. Backfill: `BACKFILL_MENTIONS_BRAND_ID` agora se seta no worker Cloudflare. `P` · depende do dono
- [ ] **Token Cloudflare definitivo até 13/set** — o atual expira; criar pelo template "Edit Cloudflare Workers" (+ Zona→DNS→Editar se quisermos operar DNS por API) e atualizar `CLOUDFLARE_API_TOKEN` no GitHub. Sem ele o deploy do server para. `P` · depende do dono
- [ ] **Fase 2 do ADR-9** (ordem sugerida): Cron Triggers nativos chamando `/api/internal/*` com `CRON_SECRET` (mata o keepalive; container dorme entre execuções) → fila (Queues) no caminho do Cloro via edge-gateway → alertas do vigia/Daily Pulse por **Email Service** (`send_email` binding, sem SMTP) → web via OpenNext (por último). `M`
- [ ] **AI Gateway `ultravis`**: dono cria no painel + `AI_GATEWAY_ACCOUNT_ID` no worker — código já roteia (PR #95). `P` · depende do dono

### P1
- [x] **Vigia de consistência — camada 1 (determinística)** — **feito (19/ago)**: 10 invariantes (duplicatas de concorrente, marcas irmãs na org, domínios malformados, pesos do IC, motor silencioso, linhas impossíveis, plataforma desconhecida, backlog de posição travado, recontagem de menções, prompt de marca sem grafia conhecida) dentro do watchdog de 15 min; achados aparecem no card Saúde do /ops e nos canais de alerta. `server/src/lib/consistency.js`.
- [ ] **Revisão 19/ago — 3 achados adiados**: (a) ramo "mentions" do detalhamento do Insights virou código morto (cards de Menções/Citações saíram do resumo) — remover ou dar novo gatilho; (b) /ops roda a varredura de consistência completa a cada render — servir o resultado do último ciclo do cron (cache); (c) `topSources` do sentimento re-extrai hostnames já computados no mesmo aggregate — deduplicar. `P`
- [ ] **Vigia: invariante "100% em 1º lugar"** — marca com ranking 1º em 100% das respostas (amostra ≥10) = suspeito, "tem que dar uma olhada no motor" (Igor 51:45, 19/ago). Check novo em `consistency.js`. `P`
- [ ] **Validar a régua do sentimento** — nota 100/50/0 é provisória ("uma nota depois a gente valida", Igor 51:05, 19/ago); revisitar quando houver mais censos. `P` · decisão com o Igor
- [ ] **Vigia de consistência — camada 2 (agente LLM semanal)** — lê os números consolidados das telas pós-censo e caça o que regra fixa não pega (rótulo que não bate com o que o número mede, média escondendo extremos, incoerência IC × Score × Insights). ~1 dia; **desbloqueado em 06/set** — a `ANTHROPIC_API_KEY` nova está no worker Cloudflare. `M` · depende do dono
- [x] **Rotacionar chaves que passaram por chat** — **feito (confirmado pelo dono em 11/ago)**.
- [ ] **Ativar alertas do watchdog por e-mail** — código pronto (PR #40); aguarda o dono criar um **e-mail dedicado** (decisão 11/ago: não usar o Gmail pessoal) e setar `ALERT_EMAIL_TO` + `SMTP_USER`/`SMTP_PASS` no worker Cloudflare (ou migrar pro Email Service nativo — fase 2 do ADR-9). Até lá o watchdog só loga. `P` · depende do dono
- [ ] **Backfill de sentimento** — script (padrão `scripts/backfill-shopping-cards.js`) pra re-analisar resultados com sentimento de fallback (ex.: os 795 "neutral" do censo de 10/ago, gravados durante o 401 da OpenAI). Nota: coluna `sentiment` é NOT NULL — não dá pra anular; o script re-analisa in-place. `P`
- [ ] **Modelo de custo completo no painel de Custos** — valor do crédito Cloro (pendente) + quota Ahrefs/Semrush. `P`

### P2
- [x] **Limpar dados de teste E2E** — **feito (11/ago)**: org e marca apagadas, snapshot no arquivo-morto.
- [ ] **SMTP custom no Supabase** — decisão 11/ago: **manter o padrão por ora**; revisitar quando houver e-mail dedicado (limite baixo do padrão + templates com marca — item #28 do feedback). `P`
- [ ] **Preencher business case** com resultado do censo Datarisk quando terminar. `P`

---

## 🧭 Decisões pendentes (precisam de você)

- [ ] **Por qual item da Onda 0 começar** — alertas vs grader grátis
- [ ] **Pricing final** — faixa R$690–990? alinhar código × landing antes de Stripe
- [ ] **Quando ligar `IS_CLOUD=true`** — só ao monetizar (degrada a POC antes disso; ver conversa)
- [x] **GitHub login** — decidido: removido (só Google + e-mail)
- [x] **AlsoAsked** — decidido: não assinar (Semrush/Ahrefs cobrem o grounding)

---

## Legenda de origem

Roadmap e drivers: `estrategia/roadmap-produto-e-valuation.md` · Benchmark:
`estrategia/benchmarking-competitivo.md` · Fontes externas:
`estrategia/fontes-externas-e-grounding.md` · Framework:
`estrategia/indice-citabilidade.md` · Estado geral: `CONTEXTO.md`.
