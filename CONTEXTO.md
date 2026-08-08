# Ultravis — Contexto, Aprendizado e Próximos Passos

> Fotografia completa do projeto até este ponto. É o **primeiro arquivo** que
> qualquer pessoa (ou IA) deve ler ao abrir o repo. Atualizar ao fim de cada
> sessão relevante.
>
> **Última atualização:** 08/ago/2026

---

## 1. O que é

**Ultravis** (ultravis.ai) — plataforma de visibilidade de marcas em IA
(AEO/GEO) para o mercado brasileiro. Fork do
[Ansvisor](https://github.com/ansvisor/ansvisor) (open source, MIT), com
marca própria, pt-BR como idioma padrão e infraestrutura independente.
Mote: **"Visão além do alcance"** / *Vision beyond reach*.

**O problema que resolve:** hoje as pessoas perguntam pra IA (ChatGPT,
Gemini, Perplexity…) em vez de pesquisar no Google. A Ultravis mede se a
**sua marca** aparece nessas respostas, contra concorrentes, e diz **o que
fazer** para aparecer mais.

## 2. Estado: NO AR e operacional ✅

- **https://ultravis.ai** — landing pública (PT/EN) + app (login → dashboard)
- Cadastro → onboarding (PT, com IA) → rastreamento → dashboard: **validado
  ponta-a-ponta com cliente real (Datarisk)**
- Modo self-hosted (`IS_CLOUD=false`): sem billing, sem limites de plano
- Login: e-mail/senha **+ Google** (social login configurado e testado)

## 3. Infraestrutura (1 dono por camada)

| Camada | Serviço | Identificação |
|---|---|---|
| Landing + App | Vercel, team `ultravis` | projeto `utravisaiclaude` · domínios ultravis.ai, www |
| API + cron | Railway, projeto `ultravis` | serviço `ultravis-server` · api.ultravis.ai · root `/server` |
| Banco + Auth | Supabase | projeto `twhqjfbealruvcbvkegc` |
| DNS | Cloudflare | registros DNS-only (nuvem cinza) |
| Repo | GitHub | `comeca-ai/ultravisai` (**privado**), branch `main` deploya tudo |

- Proteção Vercel: URLs `*.vercel.app` exigem login; domínio custom é público.
- **Ambientes e onde testar:** cada branch/PR gera uma **preview** na Vercel
  (staging do frontend, protegida por SSO); a branch `staging` tem URL fixa;
  a `main` deploya produção. Guia completo: `docs/AMBIENTES.md`.
- Cron de rastreamento: **semanal** (`DAILY_CRON_SCHEDULE=0 6 * * 1`).
- **Modo webhook do Cloro ativo** (`CLORO_WEBHOOK_URL=https://api.ultravis.ai/cloro/callback`)
  — resultados sobrevivem a restarts/deploys do server.
- **Painel de operação:** `https://api.ultravis.ai/ops` — saúde da máquina
  (uptime, memória), consumo (respostas, fila Cloro, marcas, prompts, audits),
  providers configurados (presente/ausente) e **Contas** (quem criou, e-mail,
  quando, último acesso, login). Login **próprio** (Basic Auth,
  `OPS_USER`/`OPS_PASS` no Railway), separado do login do produto. Código:
  `server/src/routes/ops.js`. Complementa (não substitui) o painel nativo do
  Railway (CPU/rede) e os consoles dos providers (custo real de token).

## 4. Providers de IA (todos configurados via env no Railway)

| Provider | Estado | Papel |
|---|---|---|
| Cloro | ✅ | Medição: scrape de 8 superfícies (ChatGPT, AIO, AI Mode, Gemini, Perplexity, Copilot, Grok, Shopping) |
| OpenAI (`gpt-5-mini`) | ✅ | Sugestões (tópicos/prompts/concorrentes/audit) + análise de sentimento — estado atual dos `*_SUGGESTION_MODEL` |
| Anthropic (Claude) | ✅ | Rastreio via API `claude-sonnet-5` + AI Agent do dashboard |
| Gemini | ✅ (reserva) | Alternativa de sugestões com grounding; free-tier estoura em ~20 req/dia |

⚠️ **Todas as chaves passaram por chat durante o setup — rotacionar em algum
momento de calma** (colar direto no painel do Railway, nunca em chat).

## 5. O que foi construído (fase de lançamento + esta sessão)

**Fundação (PRs #5–#11 do repo antigo, todos mergeados):** arquitetura pra
POCs, branding (logo, landing PT/EN, seletor de idioma), onboarding 100%
pt-BR/en, botão "Preencher com IA a partir do site", schemas compatíveis com
structured outputs da Anthropic, i18n do Insights.

**Migração + features (repo novo `ultravisai`, PRs #1–#4):**

| Entrega | O quê |
|---|---|
| **Migração de repo** | Tudo movido de `comeca-ai/ansvisor` (público, deletado) → `comeca-ai/ultravisai` (privado). Vercel e Railway apontando pro novo repo. |
| **Índice de Citabilidade (IC)** | Framework versionado (`estrategia/indice-citabilidade.md`), injetado no AI Agent (`web/src/lib/agent/citability-framework.ts`) e materializado na **página Citabilidade** (`dashboard/citability`): IC parcial honesto, dimensões medidas vs não medidas, gabarito em tabela, zonas de ação, glossário. |
| **i18n Citações** | Página de Citações 100% traduzida (filtros, tabelas, lacunas, export, seletor PT/EN). |
| **Custos admin** | Página `dashboard/admin/costs` (operador-only, 3 camadas de proteção) com estimativa de consumo por provider. |
| **Login** | Logout volta pra landing; social login só Google (GitHub removido). |
| **Painel `/ops`** | Operação com login próprio + seção Contas. |
| **Migration 00035** | `prompt_suggestions` (tabela usada pelo server e ausente — corrigia o erro "Falha ao gerar prompts"). |
| **Estratégia** | `benchmarking-competitivo.md`, `fontes-externas-e-grounding.md`, `roadmap-produto-e-valuation.md`, `BACKLOG.md`. |

## 6. Documentos-chave do repo

| Arquivo | O quê |
|---|---|
| `CONTEXTO.md` (este) | Foto do estado + aprendizado + próximos passos. **Ler primeiro.** |
| `CLAUDE.md` | Instruções pra sessões de IA (regras do fork, i18n, validação, git). |
| `ARQUITETURA-POCS.md` | Arquitetura do fork: core imutável + 4 camadas de customização, anti-drift. |
| `BACKLOG.md` | Backlog operacional priorizado (P0–P3, esforço, driver de valuation, onda). |
| `estrategia/roadmap-produto-e-valuation.md` | Roadmap ondas 0–3 × drivers de valuation. |
| `estrategia/benchmarking-competitivo.md` | Concorrência global + Brasil e onde está a lacuna. |
| `estrategia/indice-citabilidade.md` | Framework do IC (6 dimensões, 3 zonas, 4 verbos, âncora científica). |
| `estrategia/fontes-externas-e-grounding.md` | Grounding de prompts em perguntas reais (Semrush/Ahrefs). |
| `estrategia/rastreamento-eficiente.md` | Censo mensal + pulso semanal (−59% de custo). |
| `BUSINESS-CASE-DADOS.md` | Log de custos, medições reais, checklist do business case. |

## 7. Cliente piloto: Datarisk

- Conta: jhonata.emerick@gmail.com · marca "Datarisk" (datarisk.io), BR/pt
- 35 prompts ativos × 7 plataformas · concorrentes: Neurotech, Neoway,
  Semantix, Cortex
- **Censo completo despachado** (245 tarefas via modo webhook). Resultados
  no banco — **pendente consolidar no `BUSINESS-CASE-DADOS.md`.**

---

## 8. Aprendizado (o que já custou tempo/dinheiro — não repetir)

### Produto / arquitetura
- **Fork disciplinado funciona.** Todas as features foram aditivas (rota nova,
  componente novo, migration 00034+) sem tocar o core. Isso mantém o merge com
  o upstream possível. Manter essa regra é o que preserva o valor do fork.
- **IC honesto > IC bonito.** A página de Citabilidade só mostra dimensões que
  realmente mede (D1 do Site Audit, D2 da cobertura de citações) e marca o
  resto como "não medido", em vez de inventar um número cheio. Confiança > vanity.

### Custo / operação (as lições mais caras)
- **Cloro cobra no despacho, não na conclusão.** Parar um run pela UI **não
  estorna** scrapes já despachados (crédito comprometido). Um "Rodar Tudo" sem
  querer na Accenture custou 264 scrapes. → **Falta um diálogo de confirmação
  antes de despachar** (P0 do backlog).
- **Free-tiers estouram no meio do run.** Gemini free = ~20 req/dia; a Anthropic
  também acabou em um momento. Resultado: "Falha ao gerar prompts". Hoje os
  `*_SUGGESTION_MODEL` estão no `gpt-5-mini` (créditos ok). Monitorar saldo.
- **Erro de "acabou a LLM" às vezes é tabela faltando.** O "Falha ao gerar
  prompts" tinha DUAS causas: quota **e** a tabela `prompt_suggestions` ausente
  (PGRST205). Sempre checar o log real (`get_logs`) antes de culpar o provider.
- **Deploy do server matava run em modo polling** → resolvido com webhook mode.
  Ainda assim, evitar mergear durante janelas de rastreamento.

### Infra / setup
- **CI vermelha herdada é armadilha.** O `ops.js` entrou (PR #3) sem passar pelo
  `format:check` do server, deixando a `main` vermelha. → Rodar **sempre a
  bateria completa** antes de commitar: `web` (typecheck+lint+format) e `server`
  (lint+**format:check**+test). Não basta lint+test.
- **Clone raso quebra push grande** (`index-pack failed`). Na migração de repo,
  `git fetch --unshallow` resolveu.
- **O remote `origin` reverte sozinho** pro `ansvisor` (deletado) entre sessões.
  Se um `git fetch/push` falhar com "repository not found", rodar:
  `git remote set-url origin https://github.com/comeca-ai/ultravisai.git`.
- **Anthropic rejeita `minItems`/`maxItems`/`minimum`** em json_schema de
  structured outputs — validar contagens em código dentro do `withRetry`
  (padrão do PR #9).
- **OAuth do Google:** "Unable to exchange external code" = Client Secret do
  Supabase ≠ o do Google Cloud. Resetar o secret no Google e recolar no Supabase.
- **Segurança:** nenhuma chave nova em chat/commit — colar direto no painel.
  O identificador de modelo interno **não** entra em commit/PR/código.

---

## 9. Próximos passos (o que eu recomendo, na ordem)

> Backlog completo e priorizado em `BACKLOG.md`. Abaixo é a leitura editorial
> de **por onde ir agora** e por quê.

### Agora (P0 — baixo esforço, alto retorno)
1. **Diálogo de confirmação antes de despachar scrapes** — "vai enviar N
   scrapes, confirmar?". Protege a caixa (lição da Accenture). É pequeno e
   evita perda direta de dinheiro. *Comece por aqui.*
2. **Consolidar o censo Datarisk no `BUSINESS-CASE-DADOS.md`** — os dados já
   estão no banco; falta virar prova (números reais de citação × concorrentes).
   É o que transforma o piloto em case de venda.

### Próximo (P1 — constrói o diferencial)
3. **Alertas de variação** (e-mail quando score cai / concorrente entra) —
   transforma o "pulso" semanal em produto percebido. É o gancho de retenção.
4. **Grader grátis sem login** ("qual sua citabilidade?") — reusa
   `describe-from-site` + 1 run enxuto + IC parcial. Funil de topo de baixo custo.
5. **Grounding de prompts em perguntas reais** (Semrush `phrase_questions`, BR) —
   prompts com volume + intenção reais em vez de chutados. Melhora a qualidade
   de todo o resto.
6. **Citabilidade v2** — plano de ação sequenciado (o herói do produto).

### Depois (P2/monetização)
7. **Alinhar planos + Stripe** e ligar `IS_CLOUD=true` — só ao monetizar
   (antes disso degrada a POC). Pricing em discussão: faixa R$690–990.
8. **Atribuição citação → visita → lead** (GSC/GA4) — a maior lacuna do
   mercado; esforço grande, deixar amadurecer.

### Higiene contínua
- Rotacionar as chaves que passaram por chat.
- i18n das páginas restantes (Prompts, Tópicos, Configurações).
- Limpar dados de teste E2E; páginas legais (Termos/Privacidade).
- Sync seletivo com o upstream (estamos ~15 migrations atrás: pulses/alertas, GSC).

---

## 10. Decisões já tomadas (não reabrir sem motivo)

- **GitHub login:** removido — só Google + e-mail.
- **AlsoAsked:** não assinar — Semrush/Ahrefs cobrem o grounding.
- **Seletor de modelo de IA pro usuário:** não fazer nesta fase — complexidade
  sem valor percebido agora.
- **Execução agêntica / auto-publicação:** não fazer agora — capital-intensivo,
  não é o wedge.
- **Repo:** privado, `comeca-ai/ultravisai`. As features não são públicas mesmo
  o fork sendo de base MIT.
