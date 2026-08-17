# BACKLOG — Ultravis

> Backlog operacional vivo, priorizado. Destila `estrategia/roadmap-produto-e-valuation.md`,
> o benchmarking e as pendências do `CONTEXTO.md` em itens acionáveis.
> Atualizar conforme entrega/decisão. **Última atualização:** 08/ago/2026.

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

### P1
- [x] **Rotacionar chaves que passaram por chat** — **feito (confirmado pelo dono em 11/ago)**.
- [ ] **Ativar alertas do watchdog por e-mail** — código pronto (PR #40); aguarda o dono criar um **e-mail dedicado** (decisão 11/ago: não usar o Gmail pessoal) e setar `ALERT_EMAIL_TO` + `SMTP_USER`/`SMTP_PASS` no Railway. Até lá o watchdog só loga. `P` · depende do dono
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
