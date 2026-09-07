# Cookbook Cloudflare — chamadas e configs VALIDADAS (06/set/2026)

Tudo aqui rodou de verdade nesta conta. Copie e adapte; não invente sintaxe.

## 1 · Deploy de worker via API REST

Exige só `Workers Scripts: Edit`. Validado no run #8 do `deploy-edge-gateway`.
**Ressalva desde 07/set**: o `ultravis-server` tem Container, e imagem de
container **não sai pela REST crua** — o deploy dele é `npx wrangler@4.129.0
deploy` com token do template "Edit Cloudflare Workers"
(`deploy-server-container.yml`). A receita abaixo continua válida para worker
sem container e para os passos de secret/subdomínio.

```bash
ACC=749b2e9b3642e4b03321d5830e81c195
SCRIPT=ultravis-server                # o worker único (era ultravis-edge-gateway
                                      # quando isto foi validado no run #8)
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

**Três falhas de token, três sintomas diferentes** (runs #14–#17, 07/set) —
distingui-las poupa uma viagem ao painel por rodada:

| Sintoma no log | Causa | Remédio |
|---|---|---|
| `Invalid format for Authorization header [6111]`, 36 chars | secret guarda o **ID** do token (UUID) e não o valor | copiar o VALOR (só aparece na criação/*Roll*) |
| `Unable to get membership roles` | token de **conta** (não carrega `User→Memberships→Read`) | token de **usuário**, template "Edit Cloudflare Workers" |
| `Authentication error [10000]` no `PUT /workers/scripts/...`, **depois** de o whoami listar conta e papéis | token válido, sem `Workers Scripts: Edit` | editar permissões do token — o valor não muda |

Cuidado ao casar strings no CI: `Membership roles in "<conta>"` aparece na
saída de **sucesso** do whoami. Grepar por `membership` fez o run #17 acusar
"recrie o token" quando o token estava perfeito e faltava só a permissão.

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

- **1 produto = 1 worker**: `ultravis-server` em `cloudflare/server-container/`
  (src/ + wrangler.jsonc + d1/ + README). Superfície nova = rota nova ali
  dentro; worker novo só com decisão explícita do dono (§7).
- Deploy = push na main tocando `cloudflare/server-container/**` ou `server/**`
  → `deploy-server-container` publica + smoke test no summary. Verificação =
  ler o log do run, nunca supor.
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

**Causa-raiz final (run #9)**: `wrangler deploy` com `keep_vars` default
(`false`) **apaga as variáveis de texto do painel a cada deploy** — worker
ficava sem env nenhuma (`start envVars: HOST,PORT` no tail provou). Sempre
`"keep_vars": true` no wrangler.jsonc de worker deployado por CI; e valores
sensíveis no painel sempre como tipo **Secret** (sobrevivem a deploy), nunca
Text. Cinto-e-suspensório: passo de sync no workflow re-propaga do GitHub
Secrets após cada deploy (ausente = pulado com aviso no summary).

## 7 · 1 produto = 1 worker; rota interna em vez de worker novo (07/set)

Lição paga com uma bronca do dono ("que bagunça, você criou vários workers,
era para pôr tudo dentro de um"): em três dias o repo tinha `ultravis-server`,
`ultravis-edge-gateway` e `ultravis-d1-espelho` — três pipelines, três lugares
pra secret divergir e SKILL/agente apontando pro worker errado. Consolidado num
worker só; os dois órfãos apagados por `limpar-workers-orfaos.yml`.

**Como se acrescenta superfície agora** (padrão, ~1 `if` no `fetch`):

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';   // normaliza só p/ rotear
    if (path === '/espelho' || path.startsWith('/espelho/')) {
      return servirEspelho(request, env, url, path);        // atendido na edge
    }
    return getContainer(env.SERVER).fetch(request);         // request ORIGINAL
  },
};
```

Regras que vieram junto:

1. **O prefixo escolhido vira RESERVADO.** O Express monta routers na raiz
   (`app.use('/', ...)`), então o que o worker intercepta some pro container.
   Antes de escolher, inventarie as rotas do Express — e escreva no README que
   o prefixo é da edge.
2. **Auth do Express não protege rota do worker.** `/ops` tem Basic no Express;
   uma rota `/ops/algo` servida pelo worker NÃO herda nada. Proteção de rota da
   edge se implementa no worker (reusando `OPS_USER`/`OPS_PASS`, que já são
   secrets dele).
3. **Somar binding ≠ mexer em migrations.** D1/Queue/R2 entram como bloco novo
   no `wrangler.jsonc`; o array `migrations` (classes de Durable Object) fica
   INTOCADO — tag nova ali migra a classe do container em produção.
4. **Passo de infra experimental no workflow de produção é TOLERANTE.** O
   `d1 execute` do espelho nunca propaga `rc`: emite `::warning::` nomeando o
   remédio ("adicionar D1:Edit ao token no painel — o valor do token não muda,
   o secret no GitHub não precisa ser trocado"). Experimento não derruba o
   deploy que o cliente usa.
5. **Antes de apagar worker, prove que ninguém depende.** Prova que valeu aqui:
   a URL do callback do Cloro viaja em CADA tarefa (`opts.webhookUrl` →
   `requestBody.webhook.url`, de `CLORO_WEBHOOK_URL`), não é config de painel do
   Cloro — logo trocar a env já tirou o gateway do caminho. Com `keep_vars:true`
   o painel pode divergir do repo: o workflow de limpeza confere o valor
   EFETIVO (`GET /workers/scripts/<nome>/settings`) e aborta se apontar pra
   órfão.
6. **`DELETE /accounts/{acc}/workers/scripts/{nome}` apaga só o SCRIPT.** O
   banco D1, a fila e o R2 são recursos de conta e sobrevivem — foi assim que o
   `ultravis-espelho` continuou vivo e virou binding do worker único.
7. **Parser de `wrangler.jsonc` na unha**: `re.sub(r'//[^\n]*','',s)` corta no
   `https://` das vars e quebra o `json.loads`. Tire comentário só fora de
   string (versão curta em `sync-cf-secrets.yml`).

## 8 · Email Service: SMTP autenticado (descoberta 07/set)

Além do binding `send_email` (workers), o Email Service expõe **credenciais
SMTP autenticadas** no painel (dash → Email Service → Sending) — serve de
backend SMTP pra QUALQUER sistema, sem worker no meio. Uso na Ultravis:
1. Painel: verificar o domínio `ultravis.ai` (SPF/DKIM automáticos — a zona
   já é Cloudflare) e gerar credencial SMTP + remetente (ex.:
   `no-reply@ultravis.ai`).
2. **Supabase Auth** (magic link/convites): Dashboard → Authentication →
   Emails → SMTP Settings → host/porta/usuário/senha do Email Service.
3. **Vigia/Daily Pulse**: envs no worker `ultravis-server` —
   `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (Secret),
   `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` — código já pronto (watchdog.js).

## 9 · Workers Builds: conectar worker EXISTENTE ao GitHub (padrão preferido do dono)

Doc: developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Worker já existente: painel → Workers e Pages → <worker> → **Settings →
  Builds → Connect** → repo `comeca-ai/ultravisai` → branch main →
  **Root directory** = a pasta do worker (ex.: `cloudflare/d1-espelho`) →
  build command vazio → deploy command padrão (`npx wrangler deploy`).
- NUNCA usar "Create → Import a repository" pra worker que já existe —
  cria duplicata (a menos que o name do wrangler.jsonc bata exato).
- Depois de conectar: apagar/reduzir o workflow do Actions da pasta
  (deploy duplo). O que o Builds NÃO faz e fica no Actions: `d1 execute`
  (schema), sync de secrets, smoke com diagnóstico.
- Piloto: `ultravis-d1-espelho` (07/set).
