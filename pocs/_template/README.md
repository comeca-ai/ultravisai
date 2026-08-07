# POC — <nome do cliente/projeto>

> Copiado de `pocs/_template`. Preencha tudo entre `<>` e apague este bloco.

| Campo | Valor |
|---|---|
| **Cliente / projeto** | `<nome>` |
| **Branch** | `poc/<nome>` |
| **Nível** (ver ARQUITETURA-POCS.md §5) | `<0 | 1 | 2 | 3>` |
| **Topologia** (§4) | `<A — docker compose | B — Vercel + Railway + Supabase>` |
| **Projeto Supabase** | `poc-<nome>` (ref: `<ref>`) |
| **Domínio** | `<poc-nome.ultravis.ai ou localhost>` |
| **Início / prazo** | `<data>` → `<data>` |
| **Responsável** | `<quem>` |

## O que esta POC precisa provar

- `<hipótese 1 — ex.: a marca X aparece nas respostas de IA para o segmento Y?>`
- `<hipótese 2>`

## Critério de sucesso

`<ex.: dashboard com score de visibilidade real de 10 prompts × 3 engines, apresentado ao cliente em DD/MM>`

## Configuração

- Envs: preencher a partir de [`server.env.example`](./server.env.example) e [`web.env.example`](./web.env.example) — valores reais só no Railway/Vercel/`.env` local.
- Rebrand: seguir [`branding.md`](./branding.md).

## Encerramento

- [ ] Apagar projeto Supabase `poc-<nome>`
- [ ] Apagar serviço Railway
- [ ] Apagar projeto Vercel
- [ ] Registrar aprendizados aqui e arquivar o branch
