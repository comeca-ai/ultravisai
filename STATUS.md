# STATUS — visão de 1 página

> **Pra que serve:** quando estiver perdido, olhe SÓ este arquivo. Resumo do
> estado da aplicação, atualizado a cada sessão de trabalho relevante.
> Detalhes: `CONTEXTO.md` (história completa) · `DECISOES.md` (toda decisão) ·
> `BACKLOG.md` (o que vem). **Atualizado: 11/ago/2026.**

## A aplicação está no ar e saudável ✅

| Camada | Estado |
|---|---|
| Site + app (Vercel, ultravis.ai) | ✅ No ar, deploy automático da `main` |
| Server de rastreamento (Railway) | ✅ No ar (último deploy SUCCESS, 11/ago) |
| Banco (Supabase) | ✅ Ok — 37 migrations, RLS ativo, **arquivo-morto de marcas** ligado |
| Watchdog (vigia interno, 15 em 15 min) | ✅ Rodando, 5 checks (incl. marca órfã) — alertas por e-mail **desligados** até você configurar um e-mail dedicado |
| Auditoria diária de código (GitHub, 09:00 UTC) | ✅ Corrigida em 11/ago (etiqueta faltante); 1ª issue esperada em 12/ago ~06:00 BRT. Custo: ~R$ 0 (agente Claude desligado até a `ANTHROPIC_API_KEY`) |

## O cliente piloto (Polar) — números reais

- **Share of Voice 6,7%** (163 menções vs 2.262 dos concorrentes; Garmin domina com 1.096)
- Aparece em **10 de 15 prompts** (Índice de Visibilidade 66,7%) · sentimento: 27 positivos, 2 negativos
- Era tudo zero por bug de matching de nome → resolvido com **aliases de marca** + reprocessamento (10/ago)

## O que aconteceu nas últimas 48h (resumão)

1. **Caso Polar resolvido** — aliases de marca + backfill dos 184 resultados (PR #37).
2. **9 quick-wins do feedback do cliente** no ar (PR #38).
3. **Termos/Privacidade publicados** (preliminares, sem razão social) + rodapé limpo (PR #39).
4. **Alertas por e-mail prontos** (PR #40) — inativos até e-mail dedicado (decisão sua).
5. **Auditoria diária consertada** — etiqueta faltante + falso positivo silenciado (PR #42).
6. **Fix do Q&A #2**: "Preencher com IA" agora lê a URL com path (`polar.com/br`) (PR #43); demais achados no backlog.
7. **Arquivo-morto de marcas** (PR #44): qualquer marca apagada é arquivada inteira antes do delete — testado em produção.
8. **Regra "toda marca precisa de usuário ativo"** + check no watchdog (PR #45).
9. **Base limpa**: contas de teste apagadas; marcas Datarisk/Polar/Accenture apagadas **com arquivo** (515/567/488 resultados preservados); sobrou 1 cliente real ativo + 1 marca sua pausada.

## Onde cada coisa fica

| Quero ver… | Onde |
|---|---|
| Resultado da auditoria diária | GitHub → **Issues** com etiqueta `auditoria` (resumo) · Actions → run "Auditoria diária" → artefato `relatorios-auditoria` (detalhe, 14 dias) |
| Saúde do server / logs | Railway → `ultravis-server` → Logs · painel `/ops` (jobs e rastreamentos) |
| Custos e consumo | App → Custos & Consumo (só operador) |
| Feedback do cliente (30 itens + status) | `estrategia/feedback-cliente-polar-ago26.md` |
| Toda decisão tomada | `DECISOES.md` |
| Fila de trabalho | `BACKLOG.md` |

## Quem está na base (11/ago, fim do dia)

| Organização | Usuário | Marca | Status |
|---|---|---|---|
| Polar Electro 🎯 cliente | imeskelis@me.com (Igor) | Polar Electro | 🟢 ATIVA (única no censo de segunda) |
| Datarisk (dono) | jhonata.emerick@gmail.com | www.jhonataemerick.com.br | ⏸️ pausada |

Apagadas com snapshot no arquivo-morto: Datarisk (515 resultados, censo do
business case), Polar (567), Accenture (488), Polar Brasil, org E2E.

## Pendências SUAS (curtas)

1. **E-mail dedicado de operação** → depois setar `ALERT_EMAIL_TO` + `SMTP_USER`/`SMTP_PASS` no Railway (liga os avisos do watchdog).
2. **`ANTHROPIC_API_KEY`** em GitHub → Settings → Secrets → Actions (liga o agente da auditoria; ~R$ 3–10/mês).
3. **Criar `contato@ultravis.ai`** (Cloudflare Email Routing, grátis) — é o canal LGPD das páginas de Termos/Privacidade.
4. Decidir: logado → home ou dashboard (item #23 do feedback).

## Próximo trabalho de produto

**Citabilidade v2** — recomendações com código pronto pra copiar (llms.txt, schema, FAQ, metatags). O pedido ⭐ do cliente. Depois: histórico do IC (#10) e UI de aliases.
