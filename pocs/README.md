# POCs

Cada POC (prova de conceito) é um **branch** (`poc/<nome>`) + uma **pasta** aqui (`pocs/<nome>/`), criada a partir de [`_template/`](./_template).

A arquitetura completa, os níveis de POC (0–3), os pontos de customização permitidos e o playbook de ~1 hora estão em [`ARQUITETURA-POCS.md`](../ARQUITETURA-POCS.md) na raiz do repo.

## Fluxo resumido

```bash
git checkout -b poc/acme main
cp -r pocs/_template pocs/acme
# preencher pocs/acme/README.md, envs e branding.md
```

1. Criar projeto Supabase novo (`poc-acme`) e aplicar `supabase/schema.sql` (1 paste no SQL Editor).
2. Preencher os envs reais a partir dos `*.env.example` da pasta (segredos **nunca** entram no git — só no Railway/Vercel/`.env` local).
3. Aplicar o rebrand mínimo seguindo `branding.md`.
4. Deploy: `docker compose up --build` (demo interna) ou Vercel + Railway (POC exposta ao cliente).

## Regras

- Customização de POC toca **apenas**: envs, `web/src/config/site.ts`, `web/src/app/globals.css`, `web/public/logo_*.svg`, `web/messages/*.json`.
- **Nunca** editar `server/src/lib`, `server/src/workers`, `web/src/lib` ou schema core por causa de uma POC.
- Feature nova é arquivo novo (aditivo). Migration só aditiva, com prefixo `poc_`.
- Encerrou a POC: apagar projeto Supabase + serviço Railway + projeto Vercel e arquivar o branch.
