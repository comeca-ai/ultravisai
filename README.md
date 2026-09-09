# Ultravis

Plataforma de visibilidade de marcas em IA (AEO/GEO) para o mercado brasileiro.

Site: [ultravis.ai](https://ultravis.ai)

Fork operacional do [Ansvisor](https://github.com/ansvisor/ansvisor) (MIT), com marca própria, pt-BR como idioma padrão e infra independente.

## O que faz

A pessoa cola o domínio na home. Depois do cadastro, a Ultravis mede se a marca aparece nas respostas de ChatGPT, Claude, Gemini, Perplexity e outros motores — contra concorrentes — e diz o que fazer para aparecer mais.

Não inventa score na landing. Número só sai do censo.

## Stack

- `web/` — Next.js (TypeScript), Vercel, domínio ultravis.ai
- `server/` — Express, container Cloudflare, api.ultravis.ai
- `supabase/` — banco, auth, RLS

## Como rodar

```bash
cp web/.env.example web/.env.local
cp server/.env.example server/.env
cd web && yarn install && yarn dev
cd server && npm install && npm run dev
```

Schema fresco: `supabase/schema.sql`. Fonte das migrations: `supabase/migrations/`.

## Docs vivos

| Arquivo | Uso |
|---|---|
| `STATUS.md` | Estado de 1 página. Comece aqui. |
| `CONTEXTO.md` | História do produto |
| `AUDITORIA.md` | Auditoria de segurança 08/set |
| `DECISOES.md` | ADRs |
| `BACKLOG.md` | Fila |

## Licença

MIT. Código-base Ansvisor © Empler AI Inc. Camada Ultravis © comeca-ai.
