# Ultravis Server no Cloudflare (Containers)

> **Status 06/set (noite)**: secrets mínimos do Supabase colados pelo dono no
> painel do worker (CRON_SECRET não existe no Railway — normal: os endpoints
> /api/internal/* ficam trancados e o node-cron interno agenda). Este commit
> redeploya para o container nascer com os envVars novos e o smoke conferir o 200.

O server Express de `server/` rodando **intacto** num Cloudflare Container
(mesmo Dockerfile do Railway), com um Worker na frente (`src/index.js`):
todo request vai pro container; um Cron Trigger a cada 10 min mantém o
processo vivo pro `node-cron` interno seguir agendando censo/vigia/reviews.
v2 (depois): destilar as agendas em Cron Triggers nativos chamando
`/api/internal/*` com `CRON_SECRET` — aí o container dorme entre execuções.

## Requisitos (uma vez)

1. **Workers Paid** na conta (~US$5/mês — Containers não roda no free; é o
   substituto do custo do Railway, não um custo a mais);
2. Secret `CLOUDFLARE_API_TOKEN` = token do template **"Edit Cloudflare
   Workers"** (wrangler builda/publica a imagem; containers não saem pela
   REST crua, e Account API Token morre em membership roles — lição da skill);
3. Secrets do server no worker: rodar `sync-cf-secrets` com
   `worker_dir=cloudflare/server-container` depois de criar no GitHub os
   secrets da lista (Supabase, Cloro, provedores, CRON_SECRET…) — ou colar
   direto no painel do worker.

## Deploy e auditoria

Push na main tocando `server/**` ou esta pasta → workflow
`deploy-server-container` builda a imagem e publica; log completo no run.
URL: https://ultravis-server.jhonata-emerick.workers.dev

## Plano de corte (quando estiver verde e com secrets)

1. Rodar em paralelo com o Railway e comparar `/` e um endpoint de leitura;
2. Fora de janela de censo: apontar `api.ultravis.ai` (DNS já é Cloudflare)
   pro worker (custom domain no painel do worker) — web e Cloro nem percebem;
3. Observar um censo completo (segunda 06:00 UTC) com o vigia de consistência
   como juiz; só então desligar o serviço no Railway.
Rollback = voltar o DNS pro Railway.

Verificação 06/set 20:4x UTC: segredos preenchidos no painel pelo dono — run de verificação (smoke + tail com 'start envVars:').
