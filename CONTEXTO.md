# Ultravis — Contexto e Estado Atual

> Fotografia completa do projeto até este ponto. Atualizar ao fim de cada
> sessão relevante de trabalho.
>
> **Última atualização:** 07/ago/2026 (fim da sessão de lançamento)

---

## 1. O que é

**Ultravis** (ultravis.ai) — plataforma de visibilidade de marcas em IA
(AEO/GEO) para o mercado brasileiro. Fork do
[Ansvisor](https://github.com/ansvisor/ansvisor) (open source, MIT), com
marca própria, pt-BR como idioma padrão e infraestrutura independente.
Mote: **"Visão além do alcance"** / *Vision beyond reach*.

## 2. Estado: NO AR e operacional ✅

- **https://ultravis.ai** — landing pública (PT/EN) + app (login → dashboard)
- Cadastro → onboarding (PT, com IA) → rastreamento → dashboard: **validado
  ponta-a-ponta com cliente real (Datarisk)**
- Modo self-hosted (`IS_CLOUD=false`): sem billing, sem limites de plano

## 3. Infraestrutura (1 dono por camada)

| Camada | Serviço | Identificação |
|---|---|---|
| Landing + App | Vercel, team `ultravis` | projeto `utravisaiclaude` · domínios ultravis.ai, www |
| API + cron | Railway, projeto `ultravis` | serviço `ultravis-server` · api.ultravis.ai · root `/server` |
| Banco + Auth | Supabase | projeto `twhqjfbealruvcbvkegc` |
| DNS | Cloudflare | registros DNS-only (nuvem cinza) |
| Repo | GitHub | `comeca-ai/ultravisai` (privado), branch `main` deploya tudo |

- Proteção Vercel: URLs `*.vercel.app` exigem login; domínio custom é público.
- Cron de rastreamento: **semanal** (`DAILY_CRON_SCHEDULE=0 6 * * 1`).
- **Modo webhook do Cloro ativo** (`CLORO_WEBHOOK_URL=https://api.ultravis.ai/cloro/callback`)
  — resultados sobrevivem a restarts/deploys do server.

## 4. Providers de IA (todos configurados via env no Railway)

| Provider | Estado | Papel |
|---|---|---|
| Cloro | ✅ | Medição: scrape de 8 superfícies (ChatGPT, AIO, AI Mode, Gemini, Perplexity, Copilot, Grok, Shopping) |
| Gemini (`gemini-3-flash-preview`) | ✅ | Sugestões (tópicos/prompts/concorrentes/audit/resumo de site) — com busca web (grounding) |
| Anthropic (Claude) | ✅ | Rastreio via API `claude-sonnet-5` + AI Agent do dashboard; reserva das sugestões |
| OpenAI (`gpt-5-mini`) | ✅ (créditos ok) | Análise de sentimento |

⚠️ Todas as chaves passaram por chat durante o setup — rotacionar em algum
momento de calma (colar direto no painel do Railway, nunca em chat).

## 5. O que foi construído nesta fase (PRs #5–#11, todos mergeados)

- **#5** — Arquitetura para POCs (`ARQUITETURA-POCS.md`, `pocs/_template/`) +
  branding: logo 1c "Prompt eye", landing PT/EN nova em `/`, seletor de idioma,
  fix do rewrite RSC (pt-BR default)
- **#6** — Migration `00034_cloro_pending_tasks` (tabela usada pelo server e
  ausente do schema — gap herdado do upstream)
- **#7** — Onboarding 100% pt-BR/en + seletor de idioma
- **#8** — Botão "Preencher com IA a partir do site" (rota
  `POST /api/brands/describe-from-site`, aditiva)
- **#9** — Fix: schemas compatíveis com structured outputs da Anthropic
  (minItems/maxItems → validação em código) + dicas de tópicos reescritas
- **#10** — i18n do cluster visível do Insights + `BUSINESS-CASE-DADOS.md` +
  `estrategia/rastreamento-eficiente.md`
- **#11** — Insights 100% traduzido + LocaleSwitcher no sidebar do dashboard

## 6. Documentos-chave do repo

| Arquivo | O quê |
|---|---|
| `ARQUITETURA-POCS.md` | Arquitetura do fork: core imutável + 4 camadas de customização, níveis de POC, regras anti-drift, playbook |
| `estrategia/rastreamento-eficiente.md` | Estratégia censo mensal + pulso semanal (–59% de custo) |
| `BUSINESS-CASE-DADOS.md` | Log de custos, medições reais e checklist pro business case |
| `ULTRAVIS-SETUP-BR.md` | Guia de setup original (histórico; infra descrita lá foi consolidada) |
| `pocs/_template/` | Templates para novas POCs (envs de exemplo, checklist de rebrand) |

## 7. Cliente piloto: Datarisk

- Conta: jhonata.emerick@gmail.com · marca "Datarisk" (datarisk.io), BR/pt
- 35 prompts ativos × 7 plataformas · concorrentes: Neurotech, Neoway,
  Semantix, Cortex
- **Censo de kickoff INCOMPLETO**: 1º run (280 tarefas) morreu em 31/280 por
  deploy no meio (motivou o modo webhook). 27 resultados no banco.
  **Pendente: clicar "Rodar Tudo"** para o censo completo (245 tarefas).

## 8. Pendências conhecidas

1. **Rodar o censo completo da Datarisk** ("Rodar Tudo") e preencher os
   resultados no `BUSINESS-CASE-DADOS.md`
2. Aplicar o **pulso** (desmarcar plataformas T2/T3 da cauda) após o censo
3. Limpar dados de teste E2E (org `Ultravis Teste E2E`,
   ids `aaaaaaaa-e2e0-...`)
4. i18n das demais páginas do dashboard (Prompts, Tópicos, Citações,
   Configurações) — mesmo método do Insights
5. Páginas legais (Termos/Privacidade — footer da landing aponta pra `#`)
6. Sync com upstream (fork ~15 migrations atrás: pulses/alertas, GSC)
7. Rotação de chaves + SMTP custom no Supabase (e-mail padrão tem limites)
8. Ao monetizar: alinhar planos (código 50/200 vs landing 150/1.000),
   `IS_CLOUD=true` + Stripe + cron externo com `CRON_SECRET`

## 9. Lições operacionais (não repetir)

- **Deploy do server mata run em modo polling** → resolvido com webhook mode;
  ainda assim, preferir mergear fora de janelas de rastreamento
- API da Anthropic rejeita `minItems`/`maxItems`/`minimum` em json_schema —
  contagens ficam em código (padrão adotado no #9)
- Vercel Authentication default bloqueia produção sem domínio custom
- Site URL do Supabase precisa apontar pro domínio (senão e-mail de
  confirmação leva pra localhost)
- Cloudflare: registros para Vercel/Railway sempre com nuvem **cinza**
