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

## 🚀 Produto (features)

### P0 — Agora
- [ ] **Merge do PR #2** — trabalho acumulado na branch (logout, login Google, Citabilidade 5–8, Citações PT, Custos admin, curso/estratégia, migration 00035). `P` · housekeeping
- [x] **Diálogo de confirmação antes de despachar scrapes** — confirmação antes do "Rodar Tudo" (aviso de crédito/irreversibilidade + nº de prompts ativos). `P` · protege caixa (lição do despacho acidental da Accenture, 264 scrapes)
- [ ] **Alertas de variação** — e-mail quando score cai / concorrente entra (Slack depois). Transforma o pulso em produto percebido. `M` · `D3` · Onda 0

### P1 — Próximo
- [ ] **Grader grátis sem login** — "qual sua citabilidade?" (reusa `describe-from-site` + 1 run enxuto + IC parcial). Funil de topo. `M` · `D3` · Onda 0
- [ ] **Citabilidade v2 (o herói)** — plano de ação sequenciado + táticas do curso (4 verbos) + âncora do paper (+41%). `M` · `D2` · Onda 1
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
- [ ] **Termos & Privacidade → 404 (risco LGPD)** — o usuário "concorda" no cadastro com documentos inexistentes. `siteConfig.legal` aponta pra `/privacy-policy` e `/terms-of-service` que não existem. **Precisa de conteúdo/decisão jurídica** (redigir ou template + revisão). `M`
- [ ] **Rodapé com links mortos** — na landing, colunas (Sobre/Blog/Contato/Carreiras/Desenvolvedores) e Termos/Privacidade/AI Policy apontam pra `#top`; `siteConfig.links.github` aponta pro repo **upstream** `ansvisor/ansvisor`. Decidir: criar as páginas vs. remover os links + corrigir o GitHub. `P`

### P1
- [ ] **i18n páginas restantes** — Prompts, Tópicos, Configurações (verificar também Conteúdo, Auditoria, Tráfego, Shopping, Relatórios, Agent). `M` · mesmo método do Insights/Citações
- [ ] **Cache da landing no CDN** — HTML servido por SSR serverless a cada visita (TTFB ~0,6s, custo e latência à toa numa página estática). Avaliar `revalidate`/headers de cache. `P` · perf (Q&A)
- [ ] **4 bugs do docx (verificar quais persistem):**
  - [ ] Login sem mensagem "conta já existe"
  - [ ] Algo "rodando como Ansvisor" (suspeita: templates de e-mail do Supabase)
  - [ ] Tela de login travando
  - [ ] Relatório não gerado
- ✅ ~~Site URL = localhost:3000~~ — **resolvido** nesta sessão (config de OAuth do Google)

---

## 🔧 Operacional & infra

### P1
- [ ] **Rotacionar chaves que passaram por chat** — Cloro, OpenAI, Anthropic, Gemini (Google secret já resetado). `P`
- [ ] **Modelo de custo completo no painel de Custos** — valor do crédito Cloro (pendente) + quota Ahrefs/Semrush. `P`

### P2
- [ ] **Limpar dados de teste E2E** — org `Ultravis Teste E2E` (ids `aaaaaaaa-e2e0-...`). `P`
- [ ] **SMTP custom no Supabase** — e-mail padrão tem limites. `P`
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
