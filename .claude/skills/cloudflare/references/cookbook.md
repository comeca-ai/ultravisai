# Cookbook Cloudflare — chamadas e configs VALIDADAS (06/set/2026)

Tudo aqui rodou de verdade nesta conta. Copie e adapte; não invente sintaxe.

## 1 · Deploy de worker via API REST (o caminho oficial daqui)

Exige só `Workers Scripts: Edit`. Validado no run #8 do `deploy-edge-gateway`.

```bash
ACC=749b2e9b3642e4b03321d5830e81c195
SCRIPT=ultravis-edge-gateway          # nome do worker
TOKEN=$CLOUDFLARE_API_TOKEN

# metadata: module worker + bindings de var simples
cat > metadata.json <<'EOF'
{
  "main_module": "index.js",
  "compatibility_date": "2026-08-01",
  "observability": { "enabled": true },
  "bindings": [
    { "type": "plain_text", "name": "ORIGIN_URL", "text": "https://api.ultravis.ai" }
  ]
}
EOF

# upload (multipart: metadata + cada módulo ES)
curl -sS -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/$SCRIPT" \
  -H "Authorization: Bearer $TOKEN" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "index.js=@src/index.js;type=application/javascript+module"

# ativar a rota pública workers.dev do script
curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/$SCRIPT/subdomain" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled": true, "previews_enabled": false}'

# subdomínio da conta (pra montar a URL) — nesta conta: jhonata-emerick
curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/subdomain" \
  -H "Authorization: Bearer $TOKEN"
```

URL final: `https://<script>.<subdominio>.workers.dev`.

## 2 · Diagnóstico de token (sempre com o JSON cru — nunca `curl -f`)

```bash
# 1. vivo/expirado?
curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACC/tokens/verify" -H "Authorization: Bearer $TOKEN"
# 2. leitura funciona?
curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts" -H "Authorization: Bearer $TOKEN"
# 3. escrita funciona? (o PUT do bloco 1)
```

Leitura ok + escrita `{"code":10000,"message":"Authentication error"}` =
permissão em Read, falta **Edit** (editar o token no painel preserva o valor —
o secret no GitHub não precisa mudar).

## 3 · Armadilhas de wrangler (runs #2–#5)

- wrangler **3.x não lê `wrangler.jsonc`** → "Missing entry-point". Use 4.x
  (`npx wrangler@4.129.0`).
- wrangler 4 com **Account API Token** morre em "Unable to get membership
  roles" (whoami E deploy) — precisa de `User→Memberships→Read`, que token de
  conta não carrega. Ou use token de usuário do template "Edit Cloudflare
  Workers", ou fique na API REST (bloco 1).
- `wrangler dev --local` roda **sem login** — bom pra testar na sandbox
  (origin externo é bloqueado pelo egress; mocke com servidor local + `--var`).

## 4 · Bindings prontos (wrangler.jsonc)

```jsonc
{
  // fila (fase 2) — criar antes: npx wrangler queues create ultravis-cloro
  "queues": {
    "producers": [{ "binding": "CLORO_QUEUE", "queue": "ultravis-cloro" }],
    "consumers": [{ "queue": "ultravis-cloro", "max_retries": 3,
                    "dead_letter_queue": "ultravis-cloro-dlq" }]
  },
  // agenda (fase 3+) — handler: export default { async scheduled(event, env, ctx) {…} }
  "triggers": { "crons": ["0 6 * * 1"] },
  // e-mail transacional (Email Service, beta pública abr/2026) — sem chave de API
  "send_email": [{ "name": "EMAIL",
                   "allowed_destination_addresses": ["jhonata.emerick@gmail.com"] }]
}
```

Envio no código: `await env.EMAIL.send({ to, from, subject, html })` —
`from` de domínio verificado no Email Service (painel); em dev local,
`"remote": true` no binding chama o serviço real. `EmailMessage` (MIME cru)
segue suportado, mas `send()` é o caminho novo.

## 5 · Convenções do repo

- 1 worker = 1 pasta `cloudflare/<nome>/` (src/ + wrangler.jsonc + README).
- Deploy = push na main tocando a pasta → workflow publica + smoke test no
  summary. Verificação = ler o log do run, nunca supor.
- `account_id` no wrangler.jsonc não é segredo. Segredos: GitHub Secrets
  (workflow `sync-cf-secrets`) ou painel do worker.
- Toda decisão de arquitetura Cloudflare → linha no DECISOES.md, mesmo PR.

## 6 · Containers: env que não chega (lições do run #9, 06/set)

Sintoma clássico: app dentro do container em crash-loop por env ausente
("Missing SUPABASE_URL...") com o worker já cheio de secrets. Três fatos da
lib `@cloudflare/containers` 0.0.28 (conferidos no fonte, `npm pack`):

1. **`this.envVars` de construtor não confiável** — o caminho garantido é
   injetar no momento do start:
   `await this.startAndWaitForPorts({ startOptions: { envVars }, ports: [80] })`.
2. **A chave é `envVars`, não `env`** (`ContainerStartConfigOptions`) — `env`
   é ignorado em silêncio.
3. **`startAndWaitForPorts` PULA o `start()` se o container já está
   `running`** — e um supervisor tipo pm2-runtime nunca morre, então um
   container que subiu sem env fica "running" em crash-loop eterno
   (`active:1, healthy:0, failed:0`). Antes de startar com env nova:
   `running && getState().status !== 'healthy'` ⇒ `await this.destroy()`.

Observabilidade: o stdout do container NÃO sai no `wrangler tail` (só a aba
Logs do painel mostra). `console.log` no lado do worker (classe DO) SAI no
tail — logar `Object.keys(envVars)` no start é a prova barata de que a env
foi. `instance_type: "standard"` foi renomeado para `"standard-1"`.
