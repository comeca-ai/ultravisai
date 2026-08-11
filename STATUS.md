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
| Banco (Supabase) | ✅ Ok — 36 migrations, RLS ativo |
| Watchdog (vigia interno, 15 em 15 min) | ✅ Rodando — alertas por e-mail **desligados** até você configurar um e-mail dedicado |
| Auditoria diária de código (GitHub, 09:00 UTC) | ⚠️ Scanners rodam; a gravação da issue falhava por falta da etiqueta `auditoria` — **corrigido em 11/ago**, 1ª issue esperada no próximo run |

## O cliente piloto (Polar) — números reais

- **Share of Voice 6,7%** (163 menções vs 2.262 dos concorrentes; Garmin domina com 1.096)
- Aparece em **10 de 15 prompts** (Índice de Visibilidade 66,7%) · sentimento: 27 positivos, 2 negativos
- Era tudo zero por bug de matching de nome → resolvido com **aliases de marca** + reprocessamento (10/ago)

## O que aconteceu nas últimas 48h (resumão)

1. **Caso Polar resolvido** — aliases de marca + backfill dos 184 resultados (PR #37).
2. **9 quick-wins do feedback do cliente** no ar — copy/UX das telas Visibilidade, Citabilidade, Prompts e cadastro (PR #38).
3. **Termos de Uso e Privacidade publicados** (versão preliminar genérica, sem razão social) + rodapé sem links mortos (PR #39).
4. **Alertas por e-mail prontos no código** (PR #40) — inativos até ter e-mail dedicado (decisão sua).
5. **Auditoria diária consertada** (etiqueta faltante) — este PR.

## Onde cada coisa fica

| Quero ver… | Onde |
|---|---|
| Resultado da auditoria diária | GitHub → **Issues** com etiqueta `auditoria` (resumo) · Actions → run "Auditoria diária" → artefato `relatorios-auditoria` (detalhe, 14 dias) |
| Saúde do server / logs | Railway → `ultravis-server` → Logs · painel `/ops` (jobs e rastreamentos) |
| Custos e consumo | App → Custos & Consumo (só operador) |
| Feedback do cliente (30 itens + status) | `estrategia/feedback-cliente-polar-ago26.md` |
| Toda decisão tomada | `DECISOES.md` |
| Fila de trabalho | `BACKLOG.md` |

## Pendências SUAS (curtas)

1. **E-mail dedicado de operação** → depois setar `ALERT_EMAIL_TO` + `SMTP_USER`/`SMTP_PASS` no Railway (liga os avisos do watchdog).
2. **`ANTHROPIC_API_KEY`** em GitHub → Settings → Secrets → Actions (liga o agente da auditoria).
3. **Criar `contato@ultravis.ai`** (Cloudflare Email Routing, grátis) — é o canal LGPD das páginas de Termos/Privacidade.
4. Decidir: logado → home ou dashboard (item #23 do feedback).

## Próximo trabalho de produto

**Citabilidade v2** — recomendações com código pronto pra copiar (llms.txt, schema, FAQ, metatags). O pedido ⭐ do cliente. Depois: histórico do IC (#10) e UI de aliases.
