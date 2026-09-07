---
name: cloudflare
description: Como usar e configurar o Cloudflare da Ultravis — deploy do worker único, rotas novas na edge, bindings (D1, Queues, Cron Triggers, Durable Objects, Email Service), AI Gateway, secrets, diagnóstico de token e o mapa de produtos 2026. Use SEMPRE que a tarefa envolver Cloudflare, worker, edge, wrangler, fila, cron, e-mail transacional, AI Gateway, deploy do server ou erro 403/authentication em api.cloudflare.com — mesmo sem a palavra "Cloudflare" no pedido.
---

# Cloudflare na Ultravis

Conta `749b2e9b3642e4b03321d5830e81c195` · **worker ÚNICO `ultravis-server`**
(https://api.ultravis.ai — Custom Domain; e
https://ultravis-server.jhonata-emerick.workers.dev) · AI Gateway `ultravis` ·
fonte em `cloudflare/server-container/`. Sintaxes prontas e as chamadas REST
validadas: `references/cookbook.md` — leia antes de escrever config ou chamada
de API na mão.

**Regra de ouro (07/set, ordem do dono): 1 produto = 1 worker.** Precisa de
uma superfície nova? É **rota nova dentro do `ultravis-server`**, não worker
novo. Foi assim que o espelho D1 virou `/espelho` e que `ultravis-edge-gateway`
e `ultravis-d1-espelho` foram apagados. Ver cookbook §7.

## As 5 lições que custaram 7 runs (06/set) — não repita

1. **Deploy sai pelo GitHub Actions**, nunca da sandbox (egress bloqueia
   `api.cloudflare.com` e até `developers.cloudflare.com` — pesquise doc via
   WebSearch). Sem permissão de dispatch manual: dispara-se por micro-PR
   mergeado na main tocando `cloudflare/server-container/**`, `server/**` ou o
   próprio workflow.
2. **wrangler 3.x ignora `wrangler.jsonc`** ("Missing entry-point") — só 4.x lê.
3. **wrangler 4 + Account API Token = armadilha**: whoami E deploy consultam
   membership roles (`User→Memberships→Read`, que token de conta não tem).
   Por isso o deploy oficial daqui é **API REST crua** — exige só
   `Workers Scripts: Edit`.
4. **Nunca diagnostique com `curl -f`** — ele engole o JSON do erro. Rode
   verify + leitura + escrita imprimindo o corpo; leitura ok + escrita
   "Authentication error" (code 10000) = permissão está como Read, falta Edit.
5. **Segredo não passa por chat nem commit**: GitHub Secrets → workflow
   `sync-cf-secrets`; ou direto no painel do worker. Token atual expira
   13/set/2026 — o definitivo nasce do template "Edit Cloudflare Workers".

## Como fazer as tarefas comuns

- **Redeployar o worker**: push na main tocando `cloudflare/server-container/**`
  ou `server/**` → workflow `deploy-server-container` (o ÚNICO deploy) builda a
  imagem, publica, re-propaga os 15 segredos, aplica o schema do espelho D1
  (tolerante) e faz dois smokes (`/` pelo container, `/espelho?format=json`
  pelo worker). Verificar = ler o log do run.
- **Superfície nova**: **rota nova em `cloudflare/server-container/src/index.js`**
  (o `fetch` decide: prefixo conhecido = worker; resto = container). NÃO crie
  worker novo — foi o que gerou a bagunça de 07/set. Prefixo escolhido vira
  RESERVADO (o Express monta routers na raiz, então o caminho some pro
  container): confira antes com um inventário das rotas do Express. Testar
  local: `npx wrangler@4.129.0 dev --local` — roda sem login.
- **Secrets do worker**: painel (Settings → Variables and Secrets) ou
  GitHub Secrets + `sync-cf-secrets`.
- **AI Gateway**: criado no painel (IA → AI Gateway → `ultravis`). O server
  roteia quando `AI_GATEWAY_ACCOUNT_ID` existe (`server/src/lib/ai-gateway.js`);
  BYOK/Authenticated Gateway via `AI_GATEWAY_TOKEN`.
- **Diagnóstico de token/403**: sequência verify → GET → PUT do cookbook,
  sempre imprimindo o JSON.

## Mapa de produtos (estado set/2026) × uso na Ultravis

| Produto | Estado | Uso nosso |
|---|---|---|
| Workers + Workers Builds | GA | compute; Builds = push-to-deploy sem token |
| Queues · Cron Triggers · Workflows · Durable Objects | GA | orquestração-alvo (fila por prompt×motor; agenda; processos longos; estado) |
| **Containers** | **GA abr/2026** | ponte: server Express inteiro na edge sem reescrever |
| **Email Service (Email Sending)** | **beta pública abr/2026** | e-mail transacional nativo do Worker (`send_email` binding, `env.EMAIL.send()`, sem chave) — alertas do vigia/Daily Pulse |
| Browser Run (ex-Browser Rendering) | Playwright GA | sinal Rendering da auditoria; crawl próprio |
| AI Gateway | GA | painel/log/custo de toda chamada de LLM |
| Workers AI · Vectorize · AI Search (ex-AutoRAG) | GA | sentimento barato; "o que a IA sabe da marca" (backlog) |
| R2 · Turnstile · Analytics Engine · Hyperdrive | GA | storage sem egress; anti-bot; métricas; ponte SQL→Supabase |
| D1 | GA | **não é o banco** (Supabase tem auth/RLS/RPC) — só o **espelho de leitura** `ultravis-espelho` (experimento; binding `DB` do worker único, rotas `/espelho*`) |

Doutrina: compute no Cloudflare, dado no Supabase, motores reais via Cloro +
APIs dos provedores (AI Gateway na frente). Cutover de webhook nunca em
véspera de censo (seg 06:00 UTC); rollback = trocar a URL do webhook
(`CLORO_WEBHOOK_URL` nas vars do worker) de volta.
