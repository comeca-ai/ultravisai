# Ultravis no Cloudflare — o worker ÚNICO (`ultravis-server`)

> **07/set — consolidação**: era 1 produto em 3 workers (`ultravis-server`,
> `ultravis-edge-gateway`, `ultravis-d1-espelho`). Virou **um worker só** e
> **um pipeline de deploy só** (`deploy-server-container`). Rota interna em vez
> de worker novo: o espelho D1 passou a viver em `/espelho` deste mesmo worker;
> o edge-gateway morreu (encaminhava para `https://api.ultravis.ai`, que já é
> este worker desde o corte de 06/set). Ver `DECISOES.md` (07/set).

O server Express de `server/` roda **intacto** num Cloudflare Container
(mesmo Dockerfile do Railway), com um Worker na frente (`src/index.js`).

## Rotas do worker

| Caminho | Quem atende | O quê |
|---|---|---|
| `/espelho`, `/espelho/tabela/<nome>` | **o Worker, na edge** | visualizador somente-leitura do espelho D1 (binding `DB`) — nunca chega ao container |
| **qualquer outro caminho** | o **container** (Express intacto) | API `/api/*`, `/cloro/callback`, `/ops`, `/t.js`, `/track/*`, `/` … |
| `scheduled` (cron a cada 10 min) | o Worker | keepalive: mantém o container vivo pro `node-cron` interno seguir agendando censo/vigia/reviews |

`/espelho` é **prefixo reservado da edge**. O Express monta dois routers na
raiz (`app.use('/', ...)`), então uma rota `/espelho` criada lá no futuro
ficaria silenciosamente inalcançável. Conferido em 07/set: nenhuma rota do
Express usa esse prefixo (inventário completo no PR da consolidação).

v2 (depois): destilar as agendas em Cron Triggers nativos chamando
`/api/internal/*` com `CRON_SECRET` — aí o container dorme entre execuções.

## Requisitos (uma vez)

1. **Workers Paid** na conta (~US$5/mês — Containers não roda no free; é o
   substituto do custo do Railway, não um custo a mais);
2. Secret `CLOUDFLARE_API_TOKEN` = token do template **"Edit Cloudflare
   Workers"** (wrangler builda/publica a imagem; containers não saem pela
   REST crua, e Account API Token morre em membership roles — lição da skill),
   **+ permissão de conta `D1:Edit`** para o passo que aplica o schema do
   espelho (editar o token no painel preserva o valor — o secret no GitHub não
   precisa mudar). Sem `D1:Edit` o deploy **não falha**: o passo do D1 é
   tolerante e só emite aviso no summary;
3. Secrets do server no worker: `deploy-server-container` re-propaga os 15
   apenas em dispatch manual ou commit marcado `[secrets]` (um PUT por
   segredo cria uma versão do worker e um rollout do container — 15 a cada
   deploy era desperdício); para rotacionar sem redeployar, rodar
   `sync-cf-secrets` (default já é `cloudflare/server-container`) — ou colar
   direto no painel.

> **O secret é o VALOR do token, não o ID.** Os runs #14–#16 morreram em
> `Invalid format for Authorization header [code: 6111]` porque o secret
> guardava um UUID de 36 caracteres. Na tela *API Tokens* a lista mostra o
> **ID** do token (UUID, igualzinho ao `database_id` do D1); o **valor** (~40
> chars, `[A-Za-z0-9_-]`, sem hífen no padrão UUID) só aparece uma vez, ao
> criar ou dar *Roll*. O passo `Verificar credencial` do deploy detecta esse
> caso e diz em uma linha — sem nunca imprimir o conteúdo.

## Deploy e auditoria

Push na main tocando `server/**` ou esta pasta → workflow
`deploy-server-container`, que é o **único deploy do projeto**:

1. build da imagem + `wrangler deploy`;
2. sync dos 15 segredos GitHub → worker (é o que impede o container de subir
   sem env — causa-raiz dos runs #3–#9);
3. **aplica o schema D1** (`d1/schema.d1.sql`, idempotente) — tolerante a
   falta de permissão;
4. smoke em `GET /` (atravessa o container, 10×20s pro cold start) e em
   `GET /espelho?format=json` (responde no worker, sem acordar o container —
   é a prova de que o binding `DB` subiu);
5. diagnóstico com `wrangler tail` + `containers list/info` se o smoke falhar.

URL: https://ultravis-server.jhonata-emerick.workers.dev ·
produção: https://api.ultravis.ai (Custom Domain).

> O passo do D1 reaplica o schema a cada push em `server/**` também. É
> idempotente (`IF NOT EXISTS` em tudo) — custa só uma ida ao D1 por deploy.

### Rollback do DNS (herdado do `cutover-api-dns`)

`api.ultravis.ai` é **Custom Domain** deste worker desde 06/set. Rollback =
recriar o registro `api` como CNAME **DNS-only** apontando para o host antigo
(o valor original foi impresso no passo 2 do run do `cutover-api-dns`:
`gfhmddqv.up.railway.app`). Com o Railway apagado, rollback real hoje =
apontar para um host novo.

---

# Espelho D1 — schema Ultravis em SQLite/Cloudflare D1

**Experimento aprovado pelo dono (07/set/2026). Produção INTOCADA** — o banco
de verdade continua no Supabase (`twhqjfbealruvcbvkegc`); este espelho é uma
cópia estrutural em D1 para avaliar leitura na edge, sem nenhum caminho de
escrita vindo do produto.

| Onde | O quê |
|---|---|
| `d1/schema.d1.sql` | As **37 tabelas** do Postgres traduzidas pra SQLite (idempotente — `IF NOT EXISTS` em tudo; re-aplicar é seguro) |
| `wrangler.jsonc` → `d1_databases` | binding `DB` → banco `ultravis-espelho` (`b1babe44-4cdf-499c-abce-235ea8c73576`) |
| `src/index.js` → `servirEspelho()` | `GET /espelho` (tabelas + contagens) e `GET /espelho/tabela/<nome>` (5 linhas); HTML no navegador, `?format=json` força JSON |

Convenções de tradução (detalhadas no cabeçalho do `d1/schema.d1.sql`):
`uuid→TEXT`, `jsonb→TEXT` (JSON), `timestamptz→TEXT` (ISO-8601 UTC),
`numeric→REAL`, `boolean→INTEGER` 0/1, `text[]→TEXT` (JSON array),
enums→`CHECK`. PKs, FKs (com `ON DELETE`), UNIQUEs e os índices principais
(inclusive parciais e de expressão) foram preservados.

> **Apagar o worker órfão `ultravis-d1-espelho` NÃO apaga o banco.** O D1
> `ultravis-espelho` é recurso de conta, separado do script; a consolidação só
> trocou quem detém o binding.

## ⚠️ Exposição: `/espelho` é público e sem autenticação

Enquanto o banco está **vazio** (fase A) o dano é zero. **Antes da fase B**
(carga de dados reais) é obrigatório decidir: D1 não tem RLS — quem tem o
binding vê tudo, e `/espelho/tabela/<qualquer>` despejaria as tabelas de todas
as orgs (`profiles`, `api_keys`, `agent_messages`…) num domínio de produção.
Remédio pronto: HTTP Basic no próprio worker reusando `OPS_USER`/`OPS_PASS`
(já são secrets deste worker, mesmo par do `/ops` do Express) — ~15 linhas em
`servirEspelho()` + credenciais no smoke test do workflow. O Basic do Express
**não** protege `/espelho`: o worker intercepta antes do container.

## Fases

- **Fase A — espelho estrutural (atual)**: schema traduzido + visualizador +
  aplicação automática do schema no deploy. Banco vazio; prova que a tradução
  é válida e aplicável.
- **Fase B — carga de dados**: export do Supabase (CSV/JSON via service role)
  → transformação (UUID como texto, timestamps ISO, arrays/jsonb como JSON)
  → import via `wrangler d1 execute`/API. Antes da carga: (a) proteger
  `/espelho` (acima) e (b) conferir o DDL reconstruído de `sent_pulses`
  contra a produção (nota abaixo).
- **Fase C — leitura real**: apontar uma superfície de LEITURA (dashboard
  interno, relatório, read replication do D1) pro espelho e medir latência/
  custo vs. Supabase. Qualquer passo além disso (escrita, cutover) é decisão
  nova do dono — não está aprovada aqui.

## O que NÃO existe em D1 (perdido na tradução — não emulado, de propósito)

- **RLS**: as ~20 tabelas com Row Level Security ("cada org só vê o seu",
  tabelas server-only sem policy) viram tabelas SEM segurança nenhuma — D1
  não tem roles nem policies. Quem tem o binding vê tudo. Cada tabela do
  `d1/schema.d1.sql` lista no cabeçalho as policies que perdeu.
- **Supabase Auth**: o schema `auth.*` (login, magic link, `auth.users`) não
  existe. FKs para `auth.users(id)` viraram TEXT sem FK (`profiles.id`,
  `invitations.invited_by`, `api_keys.user_id`, `agent_conversations.user_id`,
  `agent_token_usage.user_id`).
- **Triggers**: `on_auth_user_created` (profile no signup), os dois
  `touch_*_updated_at` do agente e o **gatilho do arquivo-morto**
  (`brands_archive_before_delete`, migration 00037) — no espelho, DELETE de
  marca simplesmente cascateia e perde os dados relacionados.
- **RPCs**: toda a família de agregação (`insights_aggregates`,
  `competitor_aggregates`, `share_of_voice_aggregates`,
  `visibility_trend_aggregates`, `prompt_performance_aggregates`,
  `tracked_prompt_count`, `prompt_visibility_summaries`,
  `insights_filter_options`, `visible_prompt_stats`,
  `get_latest_prompt_results`) não existe — seria SQL reescrito no worker.
- **NUMERIC exato** virou REAL (ponto flutuante) — scores/preços podem ter
  diferenças de arredondamento.

### Nota: `sent_pulses` (DDL reconstruído)

O `CREATE TABLE` de `sent_pulses` não existe em nenhuma migration do repo
(herança do upstream — a tabela foi criada direto na produção). O DDL do
espelho foi **reconstruído** a partir do uso em
`server/src/lib/pulse/engine.js` + do índice parcial da migration 00038.
Conferir contra a produção antes da fase B.

## Não migradas (sem uso no código)

Levantamento feito em 07/set/2026 com `grep -rE "\.from\('<tabela>'\)"` e
grep pelo nome, em `server/src` e `web/src` (ordem do dono: "aproveita para
limpar o que não precisa"). Resultado: **1 tabela ficou fora do espelho**.

| Tabela | Evidência | Nota |
|---|---|---|
| `brand_archives` (00037) | **0 referências** em `server/src` e `web/src` (0 × `.from('brand_archives')`, 0 × pelo nome) | Quem escreve nela é o **gatilho Postgres** `brands_archive_before_delete`, não o app — e gatilhos não existem em D1, então no espelho ela nunca seria populada. **Cuidado na limpeza de produção**: "0 referências no código" aqui NÃO significa "sem uso" — é a rede de segurança do DELETE de marca, alimentada pelo banco. Remover em produção é decisão explícita do dono, nunca automática. |

Todas as outras 37 candidatas têm referências reais no código (de 2× em
`brief_usage`/`site_audit_usage` a 69× em `brands`) e migraram — incluindo as
suspeitas da lista inicial: `agent_conversations` (7×), `agent_messages` (3×),
`agent_token_usage` (4×) e `reports` (4× `.from('reports')`), todas usadas
pelas rotas do agente e de relatórios.

## Teste local (sem login, sem rede)

```bash
cd cloudflare/server-container
# o container não sobe na sandbox; para exercitar só as rotas /espelho:
npx wrangler@4.129.0 dev --local           # D1 local em .wrangler/state
# noutra aba: aplicar o schema no D1 local
npx wrangler@4.129.0 d1 execute ultravis-espelho --local --file=d1/schema.d1.sql
curl http://localhost:8787/espelho         # lista tabelas + contagens (JSON)
```
