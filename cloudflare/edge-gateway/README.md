# Ultravis Edge Gateway — POC 1 do caminho Cloudflare

Worker que recebe o webhook do Cloro na edge e encaminha, com retry, pro
server atual (Railway). **Nenhuma lógica muda de lugar neste POC** — por isso
ele é reversível em minutos. Decisão e contexto: ADR-9 (a escrever) e
DECISOES.md 06/set ("fila seria perfeito para a escala").

Testado em 06/set no runtime real (`wrangler dev`): encaminhamento com corpo
bruto e headers de assinatura intactos, retry em 5xx/rede, 404 fora das rotas.

## Subir (uma vez)

1. **Token** — Cloudflare → My Profile → API Tokens → Create Token → modelo
   "Edit Cloudflare Workers". Guardar no GitHub: repo → Settings → Secrets and
   variables → Actions → New secret → `CLOUDFLARE_API_TOKEN`.
   (Nunca colar o token em chat/commit — regra da casa.)
2. **Rodar** — GitHub → Actions → `deploy-edge-gateway` → Run workflow.
   (Depois do merge na main, qualquer push que toque `cloudflare/edge-gateway/`
   redeploya sozinho, igual Vercel/Railway.)
3. **Smoke test** — `curl https://ultravis-edge-gateway.<subdominio>.workers.dev/health`
   → deve responder `{"worker":"ok","origin":"http 200",...}`.

## Cutover (só depois do smoke test)

Trocar a URL de callback no painel do Cloro (e/ou `CLORO_WEBHOOK_URL` no
Railway) para `https://<worker>/cloro/callback`. **Fora de janela de censo**
(segunda 06:00 UTC). Rollback = apontar a URL de volta pro Railway.

## Segredos (fonte única: GitHub Secrets)

Nenhum segredo em chat, commit ou wrangler.jsonc. O fluxo é: colar o valor no
painel do GitHub (Settings → Secrets → Actions) → rodar o workflow
`sync-cf-secrets` → ele propaga via `wrangler secret put`. Rotacionar =
atualizar no GitHub e re-rodar. A lista completa pensada pra migração inteira:

| Secret | Usado a partir de | Pra quê |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | já | deploy + sync (permissão Workers Scripts: Edit) |
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | fase 2 | consumer grava resultados no banco |
| `CLORO_API_KEY` · `CLORO_WEBHOOK_SECRET` | fase 2 | submeter tarefas + verificar assinatura na edge |
| `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `GOOGLE_GENERATIVE_AI_API_KEY` | fase 3 | censo via API na edge |
| `SCRAPEDO_API_KEY` | fase 3 | varredura de site / reviews |

O gateway (fase 1) não precisa de segredo nenhum — só `ORIGIN_URL`, que é var.

## Fase 2 — fila (a escala)

Quando o volume justificar: `npx wrangler queues create ultravis-cloro`,
descomentar o binding no `wrangler.jsonc`, e o handler passa a enfileirar em
vez de encaminhar — um consumer processa com retry/DLQ nativos. O mesmo
desenho serve depois pro censo (uma mensagem por prompt×motor).

## Limitações conhecidas desta sandbox

A rede do ambiente Claude bloqueia `api.cloudflare.com` e `api.ultravis.ai`
(política de egress) — deploy e teste end-to-end saem pelo GitHub Actions,
nunca daqui. O teste local usa origin mock (`wrangler dev` + `--var`).
