# CLAUDE.md — instruções para sessões de IA neste repo

Leia primeiro: **`CONTEXTO.md`** (estado atual completo) e
**`ARQUITETURA-POCS.md`** (regras do fork).

## O que é este repo

Fork do [Ansvisor](https://github.com/ansvisor/ansvisor) operando como
**Ultravis** (ultravis.ai) — visibilidade de marcas em IA, mercado BR.
Monorepo: `web/` (Next.js 16 + next-intl, deploy Vercel), `server/`
(Express ESM, deploy Railway), `supabase/` (migrations).

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

## Git/PR

- Branch de trabalho da sessão → PR draft para `main` (template em
  `.github/`); `main` deploya automático (Vercel web + Railway server).
- Branch já mergeada = reiniciar de `origin/main`
  (`git checkout -B <branch> origin/main`), nunca empilhar sobre histórico
  mergeado.
- **Deploy do server pode coincidir com run de rastreamento** — modo webhook
  do Cloro protege os dados, mas evite mergear durante runs se possível.

## Infra (sem segredos aqui — valores só nos painéis)

- Vercel `ultravis/utravisaiclaude` · Railway `ultravis/ultravis-server` ·
  Supabase `twhqjfbealruvcbvkegc` · DNS Cloudflare (nuvem cinza).
- Env vars de modelo por função: `*_SUGGESTION_MODEL`, `AUDIT_LLM_MODEL`
  (formato `provider/modelo`). Cron: `DAILY_CRON_SCHEDULE`.
- Nunca colar segredos em chat/commits; configurar direto no painel.
