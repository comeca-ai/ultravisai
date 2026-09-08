# AUDITORIA — Ultravis (comeca-ai/ultravisai)

**Data:** 08/set/2026 · **Modo:** completo (8 caçadores em paralelo + verificação
adversarial de todo P0/P1 candidato) · **Tier identificado:** T1 — produção
real, cliente pagante (Polar Electro), multi-tenant via `organizations`/
`brands`. Não é regulado (não é banco/fintech/saúde).

Este documento é o registro formal da auditoria de segurança/produção rodada
em 08/set. Os 7 achados P0/P1 com fix de código direto **já foram corrigidos**
nos PRs #156 (mergeado) e #157 (aberto) — este relatório documenta o que foi
encontrado, o veredito de verificação, e o que ainda depende de uma decisão ou
ação do dono.

---

## 1. Veredito

Dá pra confiar na Ultravis em produção **depois que o PR #157 mergear** — não
antes. A arquitetura de autorização é sólida por desenho (guard central em
`lib/access.js`, RLS habilitado e corretamente escopado na esmagadora maioria
das tabelas, verificação de webhook HMAC bem feita, retry/backoff genuíno
reusado em 9+ módulos) e isso se confirma pelo padrão dos próprios achados:
9 findings P0/P1 num repo de ~200 rotas/módulos, a maioria omissões pontuais
num padrão que o resto do código segue corretamente — não uma arquitetura
quebrada.

Dito isso, dois dos achados eram reais e sérios: um IDOR que vazava dados de
conteúdo de um cliente pagante para qualquer conta autenticada (**corrigido,
PR #156**) e cinco policies de RLS sem `TO service_role` que deixavam a chave
pública `anon` apagar/forjar linhas de produção sem login (**corrigido, PR
#157**). Ambos já eram explorações de uma requisição HTTP só — o tipo de coisa
que vira manchete, não só incidente interno. O resto (SSRF em 2 rotas
adicionais, IDOR de billing no Stripe, corrida de idempotência no webhook do
Cloro, deploy não gateado por CI) são reais mas exigem mais contexto/sorte do
atacante para explorar — e também já corrigidos no #157.

O que ainda falta não é código: é (a) uma suíte de teste que prove isolamento
entre organizações no CI, hoje inexistente, e (b) ligar os canais de alerta do
watchdog — que já detectaram corretamente um incidente real de 13 dias de
rastreamento zerado, mas cujo alerta morreu num log que ninguém olha. Nenhum
dos dois é código que eu possa simplesmente commitar; o segundo em particular
precisa de credenciais reais que só o dono pode colocar no painel.

## 2. Scorecard

| Camada | Nota | Observação |
|---|---|---|
| Segurança de aplicação | **6/10** → 8/10 após #157 | 1 IDOR + 1 P0 de RLS reais, mas achados isolados num padrão consistente e bem desenhado |
| Dependências & supply chain | **6/10** | Sem CVE crítico explorável; ws/uuid do server vêm do pm2 (correção não-breaking disponível); web tem volume alto mas majoritariamente em tooling dev (shadcn CLI, eslint-config-next) |
| Infra & deploy (CI/CD) | **6/10** → 7/10 após #157 | Boas práticas de segredo (nunca hardcoded, diagnóstico sem vazar valor, guard fail-closed em ação destrutiva) contra Dockerfile root e deploy que não esperava o CI |
| Produção & confiabilidade | **5/10** | Desenho de detecção é bom (watchdog com 17 checks, retry com backoff em 9+ módulos) — mas os canais de alerta estão desligados desde a criação e um incidente real de 13 dias já aconteceu por causa disso |
| Qualidade & manutenibilidade | **7/10** | 251 testes server verdes, CI cobre lint/format/schema/sintaxe Cloudflare — mas zero teste de isolamento RLS entre orgs, sem error tracking (Sentry/APM) |

## 3. Findings

### P0 — corrigido (PR #157)

**[P0] Policies de RLS sem `TO service_role` liberavam DELETE/INSERT anônimo em produção · `supabase/migrations/00001_initial_schema.sql:631-637`**
Evidência: `CREATE POLICY "Service role can delete prompt results" ON prompt_results FOR DELETE USING (true);` — sem `TO service_role`, vale para `PUBLIC`, combinado com `GRANT ALL ... TO anon`.
Impacto: qualquer POST/DELETE direto ao PostgREST com só a anon key pública (sem login) apagava ou forjava linhas de `prompt_results`, `ai_traffic_logs` e `prompt_result_shopping_cards` de **qualquer organização**, incluindo o cliente pagante. Sobreviveu 46 migrations sem detecção.
Fix: migration `00047` — drop das 5 policies + revoga INSERT/UPDATE/DELETE de anon/authenticated, mantém o SELECT já escopado por org. Esforço: S. **Status: corrigido, PR #157.**

### P0 — corrigido (PR #156, já mergeado)

**[P0] IDOR em `GET /api/content/brand/:brandId` · `server/src/routes/content.js:128-165`**
Evidência: a única rota do arquivo sem `assertBrandAccess` antes da query — as outras 8 rotas do mesmo arquivo checam corretamente.
Impacto: qualquer usuário autenticado (inclusive trial) lia `title`/`description`/`source_data`/`brief` gerado por IA/`webhookResponse` de **qualquer outra organização**, incluindo o cliente pagante.
Fix: `assertBrandAccess(brandId, req.user.id)` adicionado no início do handler. Esforço: S. **Status: corrigido, PR #156.**

### P1 — corrigidos (PR #156 e #157)

**[P1] SSRF em `POST /api/content/webhook-test` · `content.js:490-524`** — sem checagem de org/brand, `fetch(webhookUrl)` direto, devolve status/erro como oráculo de rede interna. Fix: `validarUrlExterna` antes do fetch. **Status: corrigido, PR #156.**

**[P1] SSRF com exfiltração de conteúdo em `POST /api/brands/describe-from-site` · `brands.js:36-45`** — extrai título/headings/parágrafos de qualquer host informado e devolve resumo via LLM, acessível a qualquer conta recém-criada (rota de onboarding, sem organização ainda). Fix: mesmo guard `validarUrlExterna`. **Status: corrigido, PR #157.**

**[P1] Nenhum teste automatizado prova isolamento RLS entre organizações · `server/src/`** — a regressão do P0 acima sobreviveu 46 migrations exatamente por falta disso. Fix sugerido: suíte de integração com 2 orgs reais contra Supabase branch/local, travando `INSERT`/`DELETE`/`SELECT` cross-org no CI. Esforço: **M — não incluído no #157, vai para o roadmap 30/60/90.**

**[P1] Deploy não bloqueado pelo CI · `.github/workflows/deploy-server-container.yml`** — `deploy` e `ci.yml` disparavam em paralelo no mesmo push a `main`; já aconteceu de main ficar com format/lint quebrado sem travar deploy (ver PR #155 desta mesma sessão). Fix: job `check-ci` aguarda o run de CI do mesmo SHA terminar com sucesso antes de liberar `deploy`. Esforço: S. **Status: corrigido, PR #157.**

**[P1] Idempotência do `/cloro/callback` é check-then-act · `server/src/server.js:423-490`** — `SELECT` pendente → processa (com chamada de IA no meio) → `DELETE`; duas entregas do mesmo `task_id` (retry normal de webhook) podiam passar ambas antes do delete, duplicando linhas em `prompt_results` (sem constraint única) e dobrando métricas de visibilidade no dashboard do cliente. Fix: claim atômico via `DELETE ... RETURNING`, com reinserção da linha se o processamento falhar depois da claim. Esforço: S. **Status: corrigido, PR #157.**

**[P1] IDOR em `POST /api/stripe/checkout` · `web/src/app/api/stripe/checkout/route.ts:16-71`** — `organizationId` vinha do body sem validar contra o usuário autenticado; como o webhook `checkout.session.completed` escreve via `supabaseAdmin` (bypassa RLS), permitia sequestrar `stripe_customer_id`/`subscription_id` de outra organização (billing takeover), incluindo o cliente pagante. Fix: deriva `organizationId` de `profiles`, como `/portal` e `/subscription` já faziam. Esforço: S. **Status: corrigido, PR #157.**

**[P1] Canais de alerta do watchdog desligados desde a criação · `server/src/lib/watchdog.js:291,330`** — o check `tracking-silent` detectou corretamente 13 dias de rastreamento zerado (censo de 31/ago) mas `ALERT_EMAIL_TO`/`SMTP_*`/`ALERT_WEBHOOK_URL` nunca foram configurados, então o alerta foi só pro log. Incidente real já aconteceu por causa disso. **Fix não é código** — precisa de credenciais reais (webhook do Slack/Discord/Telegram, ou SMTP) só no painel Railway/Cloudflare. **Status: rastreado em `STATUS.md` como pendência nº 1 do dono; código de entrega já existe e está testado.**

### P2

- **SSRF cego em `fetchTextDirect` (robots.txt/llms.txt)** · `server/src/lib/audit/fetcher.js:51-71` — restrito a path fixo, cota mensal, exige acesso à brand. **Status: já corrigido como bônus no PR #156** (mesmo guard aplicado ao consertar o P1 irmão neste arquivo).
- **Container roda como root** · `server/Dockerfile` — sem `USER`, single-stage sobre `node:20` completo. Fix: `USER node` + mover a porta pra >1024. Esforço: M.
- **7 de 9 workflows sem `permissions:`** · `.github/workflows/*.yml` — `GITHUB_TOKEN` herda o default do repo em jobs que rodam `npm install` de terceiros junto com secrets de produção. Fix: `permissions: contents: read` em cada um. Esforço: S.
- **Open redirect em `/auth/confirm`** · `web/src/app/auth/confirm/route.ts:54-59` (duplicado em `[locale]/.../auth/confirm/route.ts`) — `resolveRedirect` aceita qualquer URL http(s) absoluta sem checar o host, vetor de phishing pós-autenticação. Fix: restringir a caminho relativo ou validar `origin`. Esforço: S.
- **`verificar-censo.yml` nunca falha o job** mesmo detectando zero coleta — a notificação nativa de falha do GitHub Actions nunca dispara. Fix: `sys.exit(1)` quando `not rows`/`not dias`. Esforço: S.
- **`fetchViaScrapeDo` sem timeout/AbortController** · `server/src/lib/audit/fetcher.js:31` — audit síncrono dentro do request HTTP pode pendurar por minutos. Esforço: S.
- **GRANT ALL residual em tabelas server-only** (`brief_usage`, `site_audit_usage`, `volume_usage`) — inofensivo hoje (RLS sem policy nega tudo), mas armadilha se uma policy futura for adicionada. Esforço: S.

### P3

- Actions de terceiros por tag mutável (`@v4`), não por SHA, em workflows com secrets de produção.
- Chamadas ao Cloro API (submit/poll) e à DataForSEO sem `AbortSignal.timeout` — inconsistente com o resto do código, que já usa o padrão certo em 7+ outros módulos.
- Sem verificação no boot de que `CLORO_WEBHOOK_SECRET` está configurado em produção — cai silenciosamente pro modo sem assinatura.
- Server actions de leitura de brand (`brand.ts`, `tracking.ts`) dependem só de RLS, sem checagem de sessão explícita em código (defesa em profundidade; RLS cobre corretamente hoje).
- Sem Sentry/APM nem handler global de `uncaughtException`/`unhandledRejection`.
- Backup do Postgres depende do padrão da plataforma Supabase — sem evidência de restore testado (pergunta em aberto, não falha confirmada).

## 4. Dependências

**Server (produção, `npm audit --omit=dev`):** 17 vulnerabilidades (1 low, 5
moderate, 11 high) — nenhuma crítica. A maioria (`ws`, `socket.io-adapter`,
`engine.io`, `lodash`, `path-to-regexp`, `qs`, `undici` etc.) chega
transitivamente via `pm2`, o process manager do container. As de `ws`
("Uninitialized memory disclosure" / "Memory exhaustion DoS", GHSA-58qx-3vcg
-4xpx e GHSA-96hv-2xvq-fx4p) são as mais relevantes — o server expõe
Socket.IO publicamente. `npm audit fix` (sem `--force`) resolve a maior parte
sem bump major; `pm2` e `uuid` precisam de bump major (`isSemVerMajor: true`)
e ficam pra avaliação separada.

**Web (`yarn audit`):** 231 vulnerabilidades (16 low, 116 moderate, 99 high) —
volume alto mas concentrado em ferramentas de dev (`shadcn` CLI,
`eslint-config-next` → `fast-glob`/`micromatch`/`picomatch`), não em código
que roda em produção no navegador do cliente. Vale uma passada, mas não é
urgente igual ao lado server.

Comando de fix (não-breaking, primeiro passo):
```bash
cd server && npm audit fix && npm test   # confirmar que os 251 testes continuam verdes
```

## 5. Quick wins da semana

1. **Merge do PR #157** — fecha o P0 de RLS e 4 P1 restantes. Maior impacto/esforço de todos.
2. **`npm audit fix` no server** (sem `--force`) + rodar a suíte — fecha a maior parte das 17 vulnerabilidades de produção sem bump major.
3. **Ligar 1 canal de alerta do watchdog** (webhook Slack/Discord, minutos pra criar) — o código já existe e está testado; só falta a env var no painel.
4. **`permissions: contents: read`** nos 7 workflows que não têm — 15 minutos, fecha um P2 real de supply chain.
5. **`sys.exit(1)` em `verificar-censo.yml`** quando detecta zero coleta — reaproveita a notificação nativa do GitHub Actions, poucas linhas.

## 6. Roadmap 30/60/90

**30 dias**
- Merge #157 (P0/P1 restantes).
- `npm audit fix` no server + revisão do que sobrar do lado web.
- Ligar pelo menos 1 canal de alerta do watchdog (owner action).
- `permissions:` nos 7 workflows + fix do `verificar-censo.yml` que nunca falha.

**60 dias**
- Suíte de teste de isolamento RLS entre organizações no CI (P1, esforço M) — a rede de segurança que teria pego o P0 desta auditoria antes de chegar em produção.
- Corrigir open redirect em `/auth/confirm` (2 cópias).
- `USER node` no Dockerfile do server + revisar porta.
- Pinar por SHA as actions de terceiros nos workflows que carregam secrets de produção.

**90 dias**
- Handler global de `uncaughtException`/`unhandledRejection` + avaliar Sentry free tier.
- Uniformizar `AbortSignal.timeout` nas chamadas restantes (Cloro submit/poll, DataForSEO, Scrape.do síncrono).
- Testar um restore de backup real via Supabase branching, documentar RTO/RPO em `STATUS.md`.
- Boot-time check que falha alto se `CLORO_WEBHOOK_SECRET` estiver ausente em produção.

## 7. Não faça agora

- **Kubernetes, service mesh, multi-região** — T1 com 1 container Cloudflare já atende; não há sinal de carga que justifique.
- **Migrar de Supabase para Cloudflare D1** — avaliado e adiado nesta mesma sessão (falta RLS/Auth equivalente no D1; risco desnecessário com cliente pagante ativo). Rever só se o Supabase virar bloqueio real de custo/performance.
- **Gatus/Prometheus ou APM pesado** — decisão já documentada (ADR-8, `DECISOES.md` 10/ago) de construir monitoramento próprio; correta pro estágio. Sentry free tier (item do roadmap 90 dias) é suficiente por enquanto, não um APM completo.
- **SOC 2, pentest formal, SSO/2FA corporativo** — só fazem sentido quando um cliente enterprise exigir contratualmente; não hoje.
- **Microserviços** — o Express monolito com módulos bem separados (`lib/`, `routes/`, `middleware/`) não está no ponto de dor que justificaria a fragmentação.
- **Reescrever `lib/access.js` ou o padrão de RLS** — o desenho está certo (confirmado nesta auditoria); o problema era omissão pontual, não arquitetura. Ir atrás de "reescrever pra ser mais seguro" seria o overengineering errado quando o fix real é 5 linhas de migration.

## 8. O que está bom

- **Zero segredo real vazado** — nem no código, nem no histórico completo do git (`git log --all` com busca por padrões de chave conhecidos), nem em nenhum dos 9 workflows do GitHub Actions.
- **`lib/access.js`** centraliza os guards de posse (`assertBrandAccess`, `assertOpportunityAccess`, `assertPromptAccess`) e é usado consistentemente na esmagadora maioria das rotas — o IDOR encontrado era a única exceção em todo o diretório `routes/`.
- **RLS bem desenhado onde importa**: a maioria das tabelas de tenant tem policies corretamente escopadas por organização/brand, com um precedente exemplar (migration `00016`) de como fechar um gap documentando o raciocínio — o padrão certo existe e é seguido, o P0 desta auditoria era a exceção, não a regra.
- **Verificação de webhook do Cloro está correta**: HMAC-SHA256, comparação em tempo constante, checagem de timestamp contra replay, parse só após validar assinatura, 7 testes unitários cobrindo os casos de borda.
- **Resiliência real, não decorativa**: `withRetry` com backoff exponencial reusado em 9+ módulos, degradação graciosa em `analyzeSentimentAI`/`updateTargetUrlStats`/`persistShoppingCards`, `Promise.allSettled` isolando falhas por tarefa no tracking-worker.
- **Watchdog com desenho sólido**: 6 checks de infra + 11 invariantes de negócio a cada 15 min, avaliação pura e testável separada da coleta — só falta o fio do alerta, não o desenho.
- **Cultura real de converter incidente em checagem automatizada**: deploy-drift nasceu de um incidente de 9 dias (17/ago), `ci.yml` cobre um gap que já derrubou um deploy (run #2/#22) — o time aprende e institucionaliza em código.
- **Disciplina de segredo em CI**: nenhum hardcoded, `.dockerignore` correto, diagnóstico de token nunca ecoa valor, ação destrutiva (`limpar-workers-orfaos`) com trava fail-closed.
- **251 testes automatizados no server, todos verdes**, com CI cobrindo lint, format, schema consolidado e sintaxe dos workers Cloudflare — base de qualidade real pra construir em cima.

---

## Próximos passos sugeridos

1. **`/security-review`** do Claude Code no fluxo de dev, + a GitHub Action
   `anthropics/claude-code-security-review` no PR — review semântico contínuo.
2. **Semgrep no CI** como gate determinístico só pros P0 corrigidos aqui não
   voltarem (regra específica, não ruleset gigante).
3. **Renovate/Dependabot** já está ativo (10 PRs abertos nesta sessão) — a
   camada 2 já roda sozinha.

Reauditoria: `express` a cada release grande; `completo` a cada trimestre.

---
🤖 Gerado com [Claude Code](https://claude.com/claude-code)
