# Espelho D1 — schema Ultravis em SQLite/Cloudflare D1

**Experimento aprovado pelo dono (07/set/2026). Produção INTOCADA** — o banco
de verdade continua no Supabase (`twhqjfbealruvcbvkegc`); este espelho é uma
cópia estrutural em D1 para avaliar leitura na edge, sem nenhum caminho de
escrita vindo do produto.

## O que tem nesta pasta

| Arquivo | O quê |
|---|---|
| `schema.d1.sql` | As **37 tabelas** do Postgres traduzidas pra SQLite (idempotente — `IF NOT EXISTS` em tudo; re-aplicar é seguro) |
| `wrangler.jsonc` | Worker `ultravis-d1-espelho` + binding `DB` → banco `ultravis-espelho` |
| `src/index.js` | Worker de visualização: `GET /` (tabelas + contagens) e `GET /tabela/<nome>` (5 linhas de amostra) |
| Workflow | `.github/workflows/deploy-d1-espelho.yml` — aplica o schema (`wrangler d1 execute --remote`) e publica o worker |

Convenções de tradução (detalhadas no cabeçalho do `schema.d1.sql`):
`uuid→TEXT`, `jsonb→TEXT` (JSON), `timestamptz→TEXT` (ISO-8601 UTC),
`numeric→REAL`, `boolean→INTEGER` 0/1, `text[]→TEXT` (JSON array),
enums→`CHECK`. PKs, FKs (com `ON DELETE`), UNIQUEs e os índices principais
(inclusive parciais e de expressão) foram preservados.

## Fases

- **Fase A — espelho estrutural (este PR)**: schema traduzido + worker de
  visualização + workflow de deploy. Banco vazio; prova que a tradução é
  válida e aplicável.
- **Fase B — carga de dados**: export do Supabase (CSV/JSON via service role)
  → transformação (UUID como texto, timestamps ISO, arrays/jsonb como JSON)
  → import via `wrangler d1 execute`/API. Antes da carga, conferir o DDL
  reconstruído de `sent_pulses` contra a produção (ver nota abaixo).
- **Fase C — leitura real**: apontar uma superfície de LEITURA (dashboard
  interno, relatório, read replication do D1) pro espelho e medir latência/
  custo vs. Supabase. Qualquer passo além disso (escrita, cutover) é decisão
  nova do dono — não está aprovada aqui.

## O que NÃO existe em D1 (perdido na tradução — não emulado, de propósito)

- **RLS**: as ~20 tabelas com Row Level Security ("cada org só vê o seu",
  tabelas server-only sem policy) viram tabelas SEM segurança nenhuma — D1
  não tem roles nem policies. Quem tem o binding vê tudo. Cada tabela do
  `schema.d1.sql` lista no cabeçalho as policies que perdeu.
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

## Passo do dono (uma vez, antes do primeiro deploy)

1. **Criar o banco**: painel → Storage & Databases → D1 → Create →
   nome `ultravis-espelho`; colar o **Database ID** no
   `wrangler.jsonc` desta pasta (campo `database_id`, hoje com o placeholder
   `PREENCHER_NO_PAINEL` — o workflow bloqueia o deploy até isso ser feito).
   Alternativa por CLI: `npx wrangler@4.129.0 d1 create ultravis-espelho`.
2. **Token**: o secret `CLOUDFLARE_API_TOKEN` precisa, além do template
   "Edit Cloudflare Workers", da permissão de conta **D1:Edit** (editar o
   token no painel preserva o valor — o secret no GitHub não muda).

Depois disso, push na main tocando `cloudflare/d1-espelho/**` aplica o schema
e publica `https://ultravis-d1-espelho.jhonata-emerick.workers.dev/`.

## Teste local (sem login, sem rede)

```bash
cd cloudflare/d1-espelho
npx wrangler@4.129.0 dev --local     # D1 local em .wrangler/state
# noutra aba: aplicar o schema no D1 local
npx wrangler@4.129.0 d1 execute ultravis-espelho --local --file=schema.d1.sql
curl http://localhost:8787/          # lista tabelas + contagens
```
