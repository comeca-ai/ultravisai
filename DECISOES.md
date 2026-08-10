# DECISÕES — log rastreável

> Registro cronológico de TODA decisão do projeto (produto, técnica, negócio).
> **Regra:** decisão tomada = linha adicionada aqui, no mesmo PR do trabalho.
> Formato: data · decisão · motivo curto · onde está o detalhe.
> Decisões técnicas de arquitetura têm ADR em `docs/ARQUITETURA.md` §8.

| Data | Decisão | Motivo | Detalhe |
|---|---|---|---|
| 03/ago | Forkar o Ansvisor (MIT) como base da Ultravis, mercado BR | Não construir do zero; MIT permite produto comercial fechado | `ARQUITETURA-POCS.md` |
| 03-07/ago | Fork disciplinado: core imutável, features aditivas, migrations ≥00034 | Manter sync com upstream viável | ADR-5 |
| 07/ago | Infra: Vercel (web) + Railway (server) + Supabase + Cloudflare DNS-only | Web serverless + worker persistente; ver ADR-1 | `docs/ARQUITETURA.md` |
| 07/ago | pt-BR default sem prefixo; en em /en; i18n obrigatório em toda UI | Mercado BR primeiro | `CLAUDE.md` |
| 07/ago | Cloro em modo webhook (não polling) | Deploy matava runs; resultados sobrevivem a restart | ADR-2 |
| 07/ago | Cron de rastreamento semanal (seg 06:00 UTC), não diário | Custo: censo mensal + pulso (−59%) | `estrategia/rastreamento-eficiente.md` |
| 07/ago | `IS_CLOUD=false` até monetizar | Billing/limites degradariam a POC | BACKLOG (decisões) |
| 08/ago | Índice de Citabilidade como diferencial central (6 dimensões, 3 zonas) | Ninguém produtizou score acionável — white space validado | `estrategia/indice-citabilidade.md`, benchmarking |
| 08/ago | IC parcial honesto: só mostrar dimensões medidas | Confiança > vanity metrics | página Citabilidade |
| 08/ago | Migrar para repo privado `comeca-ai/ultravisai`; deletar o público | Features não são públicas apesar da base MIT | CONTEXTO §3 |
| 08/ago | Login social só Google; GitHub removido | Público-alvo não é dev | CONTEXTO §10 |
| 08/ago | NÃO assinar AlsoAsked | Semrush/Ahrefs (já pagos) cobrem o grounding | `estrategia/fontes-externas-e-grounding.md` |
| 08/ago | NÃO ter seletor de modelo de IA pro usuário nesta fase | Complexidade sem valor percebido | conversa registrada em CONTEXTO §10 |
| 08/ago | NÃO fazer execução agêntica/auto-publicação agora | Capital-intensivo; não é o wedge | `estrategia/roadmap-produto-e-valuation.md` §4 |
| 08/ago | Não competir por preço; faixa preliminar R$690–990 | Ancorar no valor do IC; Promptado ocupa o low-cost | benchmarking |
| 08/ago | Modelos de sugestão → `openai/gpt-5-mini` (Gemini free estourou; Anthropic sem crédito) | Continuidade de operação | env Railway |
| 08/ago | Custos & Consumo restrito a operador (allowlist de e-mail, 3 camadas) | Dado operacional não é do cliente | `web/src/lib/admin.ts` |
| 08/ago | Painel `/ops` com Basic Auth própria, separado do login do produto | Operação independente do app; jobs são server-only (RLS) | ADR-6, `server/src/routes/ops.js` |
| 08/ago | Staging = previews da Vercel + branch `staging`; SEM stack isolado por ora | Previews cobrem UI; stack isolado só quando backend pesado/pagantes | `docs/AMBIENTES.md` |
| 08/ago | Citabilidade reformulada: desbloqueio progressivo + enxugar | Direção escolhida pelo dono entre 4 opções | PR #9 |
| 08/ago | Monitoramento de log no `/ops` (não na página admin do app) | Tabela `jobs` é server-only; app não consegue ler | ADR-6, PR #9 |
| 08/ago | Confirmação obrigatória antes de "Rodar Tudo" | Scrape cobra no despacho e é irreversível (264 da Accenture) | PR #10 |
| 08/ago | MCP rebrandeado `ultravis`; prefixo de API key `ans_` mantido | Trocar prefixo invalidaria chaves existentes | PR #11, `docs/MCP.md` |
| 08/ago | API v1/metrics fica no Next.js (não portar pra Express; não usar FastAPI) | Já existe pronta no app; 2º runtime só p/ ML futuro | ADR-4, conversa FastAPI |
| 10/ago | Fix crítico: landing indexável (remover noindex herdado); app segue noindex | Produto de AEO invisível pra IA era regressão do fork | PR #14 |
| 10/ago | Termos/Privacidade (LGPD) e rodapé com links mortos → P0 no backlog, aguardando decisão de conteúdo | Precisa texto jurídico / decisão criar-vs-remover | BACKLOG P0 QA |
| 10/ago | Monitoramento: watchdog próprio no server + (futuro) uptime externo; NÃO adotar Gatus/Prometheus agora | Regra de domínio não existe em prateleira; zero infra nova; revisitar ao escalar | ADR-8, PR #17 |
| 10/ago | Condição acordada: auditoria de código diária via GitHub (scanners + agente Claude + Dependabot) | Vigilância contínua como pré-requisito do plano de monitoramento | PR #18, `.github/workflows/auditoria.yml` |
| 10/ago | Marcas de teste (Accenture, jhonataemerick) pausadas (`is_active=false`) | Censo queimou ~419 créditos com marcas de teste | banco (10/ago) |
| 10/ago | NÃO mergear os 14 PRs do Dependabot antes do teste do cliente | Major bumps arriscados (pm2 7, eslint 10) na véspera | conversa 10/ago |
| 10/ago | Sentimentos falsos-neutros do censo 10/ago: manter e criar script de backfill (coluna é NOT NULL) | Anular viola schema; re-análise in-place depois | BACKLOG |
| 10/ago | Feedback do cliente Polar estruturado; ordem de ataque: chave OpenAI → leva copy/UX (9×P) → Citabilidade v2 (#15+#4) → histórico do IC | Maximizar percepção com menor esforço | `estrategia/feedback-cliente-polar-ago26.md`, PR #35 |
| 10/ago | Log de decisões obrigatório (este arquivo), atualizado no mesmo PR de cada decisão | Rastreabilidade total exigida pelo dono | PR #36 |
| 10/ago | Diagnóstico corrigido: run do cliente com SoV 0 / sentimento neutro NÃO era a chave (ambas válidas, testadas via banco) — era **matching exato do nome** ("Polar Electro" nunca aparece; IAs escrevem "Polar"). Itens 1-2 do feedback sim eram a chave morta (onboarding às 21:55 de dom) | Evidência: 0 menções em 184 resultados; teste HTTP 200 nas duas chaves | `estrategia/feedback-cliente-polar-ago26.md` |
| 10/ago | **NÃO renomear a marca do cliente** — o produto se adapta à marca, não o contrário. Fix: **aliases de marca** (migration 00036) + backfill dos 184 resultados a partir do texto salvo (zero crédito Cloro) | Nome corporativo é dado do cliente; problema recorrente pra qualquer razão social | migration 00036, `server/src/lib/backfill-mentions.js` |
| 10/ago | Backfill executável por env (`BACKFILL_MENTIONS_BRAND_ID` + redeploy) em vez de shell/rota | Sem exec no Railway; proxy bloqueia chamadas diretas; idempotente | `lib/backfill-mentions.js` |
