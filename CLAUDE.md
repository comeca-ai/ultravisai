# CLAUDE.md — instruções para sessões de IA neste repo

Leia primeiro: **`STATUS.md`** (1 página) · **`BACKLOG.md`** (fila viva) ·
**`CONTEXTO.md`** (história) · **`ARQUITETURA-POCS.md`** (regras do fork).

## Ordem vigente (10/set) — NÃO negociar

1. **A base é o Supabase** (`twhqjfbealruvcbvkegc`). Etapa D1 **encerrada**.
   Não migrar banco. Não abrir PR de sync/cutover/Hyperdrive/worker novo/
   “fase B/C”. D1 `ultravis-espelho` é espelho de ops, vazio de propósito
   até o dono pedir número de censo na edge.
2. **Trabalho desta sessão = zerar o `BACKLOG.md`.** Só o que está aberto
   em **P0** e **P1**. Item novo só entra com linha em `DECISOES.md` no
   mesmo PR. Não reabrir o funil do Ansvisor nem a Fase 2 do ADR-9.
3. **Melhorar o backlog, não inflar.** Feito → `[x]` na hora. Morto /
   superado → some (não fica 80 linhas de história). Dono decide prioridade;
   a IA não inventa fila “enquanto isso”.
4. Segredo **nunca** em chat/commit. Token Cloudflare não se cola aqui.

## O que é este repo

Fork do [Ansvisor](https://github.com/ansvisor/ansvisor) operando como
**Ultravis** (ultravis.ai) — visibilidade de marcas em IA, mercado BR.
Monorepo: `web/` (Next.js 16 + next-intl, deploy Vercel), `server/`
(Express ESM, **Cloudflare Container** `ultravis-server` em
`api.ultravis.ai`), `supabase/` (migrations). Railway **apagado**.

## Regras do fork (anti-drift) — IMPORTANTES

- **Não reescrever o core**: `server/src/lib`, `server/src/workers`,
  `web/src/lib`, `plans.js`/`plans.ts`. Bugfix pontual e documentado é ok;
  refactor não.
- Features novas = **aditivas**: rota nova, componente novo, migration nova
  (numerar a partir de `00034+`; upstream também usa esses números — nomes de
  arquivo diferentes evitam conflito).
- Customização vai nas camadas: env vars (modelos por função, cron), marca
  (`web/src/config/site.ts`, `globals.css`, logos), dados (dashboard),
  extensões.

## i18n (obrigatório em qualquer UI nova/tocada)

- `next-intl`; locales `pt-BR` (default, sem prefixo) e `en` (`/en/...`).
- Strings SEMPRE via `useTranslations('<namespace>')` nos DOIS arquivos
  `web/messages/pt-BR.json` e `en.json`. Nenhuma string hardcoded.
- Hook antes de early-returns (rules of hooks); arrays via `t.raw()`;
  plurais via ICU `{count, plural, ...}`.
- Anthropic structured outputs rejeitam `minItems>1`/`maxItems`/`minimum`
  em schemas de `generateObject` — contagens validam em código dentro do
  `withRetry` (padrão do PR #9).

## Validação antes de commitar

```bash
cd web && yarn typecheck && yarn lint && yarn format   # zero erros E zero warnings
cd server && npm run lint && npm test                  # 124+ testes verdes
```

Após adicionar migration: `bash supabase/build-schema.sh` (regenera
`schema.sql`; CI cobra).

## Rastreabilidade de decisões (obrigatório)

- **Toda decisão** (produto, técnica, negócio) vira uma linha em `DECISOES.md`
  — **no mesmo PR** do trabalho. Formato: data · decisão · motivo · detalhe.
- Decisões de arquitetura ganham também um ADR em `docs/ARQUITETURA.md` §8.
- Estilo de resposta: pronto e direto; sem re-litigar decisão já registrada.

## Git/PR

- Branch de trabalho da sessão → PR draft para `main` (template em
  `.github/`); `main` deploya automático (Vercel web + worker Cloudflare).
- Branch já mergeada = reiniciar de `origin/main`
  (`git checkout -B <branch> origin/main`), nunca empilhar sobre histórico
  mergeado.
- **Deploy do server pode coincidir com run de rastreamento** — modo webhook
  do Cloro protege os dados, mas evite mergear durante runs se possível.

## Infra (sem segredos aqui — valores só nos painéis)

- Vercel `ultravis` · Cloudflare Worker `ultravis-server` (`api.ultravis.ai`) ·
  Supabase `twhqjfbealruvcbvkegc`.
- Env vars de modelo por função: `*_SUGGESTION_MODEL`, `AUDIT_LLM_MODEL`
  (formato `provider/modelo`). Cron: `DAILY_CRON_SCHEDULE`.
- Qualquer tarefa Cloudflare: skill **`cloudflare`** e/ou agente
  **`cloudflare-ops`**. **Não** usar isso pra retomar migração de banco.
