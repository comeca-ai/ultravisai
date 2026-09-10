# BACKLOG — Ultravis

> Fila viva. Se não está em **P0** ou **P1**, não entra na sessão.
> **Atualizado: 10/set/2026.** Ordem: parar migração D1 · zerar isto · não inflar.

## Como ler

- `P0` agora · `P1` próximo · `P2` estoque (não abrir nesta sessão)
- `P` horas–1 dia · `M` dias · `G` semanas
- `[x]` some da P0/P1 na sessão seguinte (histórico vai pra `DECISOES.md`)

---

## ⛔ Não fazer (10/set)

- Migrar Supabase → D1, dual-write, Hyperdrive, worker novo, “fase B/C”
- Fase 2 do ADR-9 (Cron Triggers nativos, Queues, OpenNext) — compute já
  está no Cloudflare Container; não é a fila
- Portar novidade do Ansvisor sem linha em `DECISOES.md`
- Colar token/chave em chat

D1 `ultravis-espelho` = espelho de ops. Código da ponte fica. **Não é
produto.** Carga só se o dono pedir e o host for `twhqjfbealruvcbvkegc`.

---

## P0 — zerar agora

Ops que deixam Polar cego. Código de vários já existe; falta clique ou
um PR pequeno.

| # | Item | Quem | Estado |
|---|---|---|---|
| 1 | Recriar token Cloudflare **antes de 13/set**, colar só em `CLOUDFLARE_API_TOKEN`, revogar o vazado | dono | aberto |
| 2 | Actions → `limpar-workers-orfaos` → Run (apaga `ultravis-d1-espelho`) | dono | disparado 10/set — conferir verde |
| 3 | `OPS_USER`/`OPS_PASS` de var texto → Secret + `sync-cf-secrets` | dono | aberto |
| 4 | Ligar 1 canal do watchdog (`ALERT_WEBHOOK_URL` ou SMTP) | dono | código pronto, alerta só no log |
| 5 | Conferir `SUPABASE_URL` do worker vs cookie `sb-<ref>-auth-token` (incidente 401 em 5 telas) | dono | hipótese aberta |
| 6 | GitHub Secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no repo (destrava `verificar-censo`) | dono | 8 runs vermelhos |
| 7 | Merge [PR #193](https://github.com/comeca-ai/ultravisai/pull/193) (fecha a etapa D1 no texto) | dono | aberto |
| 8 | Consolidação Polar (`supabase/scripts/consolidar-polar.sql`) no SQL Editor do projeto certo | dono | script pronto |

Nada disto é migração. É deixar o produto que já está no ar honesto.

---

## P1 — produto Polar (próximo PR de código)

Ordem sugerida. Um PR por linha.

1. **UI de aliases de marca** — backend existe (00036). Polar Electro. `P`
2. **Onboarding:** Brazil → `pt`; progresso/ETA em “sugerir tópicos”; marca
   como rascunho até o fim do wizard. `P/M`
3. **3 Visibility Scores na UI** — uma fórmula por tela, ou uma nota só
   (decisão do dono nas regras 09/set). `M`
4. **Landing vs código** — 150 prompts × 4 motores vendidos vs 50 × 2 no
   código. Ou muda copy ou muda gate. `P`
5. **`IS_CLOUD`** — conferir valor em produção; `false` = ilimitado. `P` · dono
6. **Gráfico escala errada (#14)** — aguarda print do Igor. `P`
7. **MCP** — validar `tools/list` com key real; posicionar. `P`
8. **Citabilidade v2** (kit pronto pra copiar) — pedido ⭐ do cliente.
   Código do kit já existe; falta a tela entregar o arquivo. `M`

---

## P2 — estoque (não abrir nesta sessão)

Não apaguei: está em `DECISOES.md` / seções antigas do git. Recolocar na
P1 só com o dono.

- Sinais IC que faltam (rendering, hreflang, title, D2/D3/D6)
- Insights v3 (funil da citação, scatter, heatmap) — mockup 19/ago
- Página Score de Visibilidade (6 dimensões / juiz LLM)
- Pacotes Sinal/Alcance/Domínio, 9 motores, grader grátis, GSC/GA4
- Funil `[ansvisor]` (Visibility Score deles, OpenRouter, range 7/30/90)
- ADR-9 fase 2, AI Gateway no painel, backfill de sentimento
- Recálculo retroativo de `citation_count` — Actions `recontar-citacoes`,
  primeiro com `aplicar=nao`

---

## Decisões do dono (travam P1)

- [ ] Recalcular citações no histórico ou só daqui pra frente
- [ ] Pricing real (código 49/249 × landing 390/1290 × faixa 690–990)
- [ ] Quando `IS_CLOUD=true`
- [ ] Home logado: dashboard ou marketing
- [ ] 4 divergências graves em `docs/regras-de-negocio-09set-v01.html`

---

## Prompt pra colar no início da sessão

```
Leia CLAUDE.md e BACKLOG.md.

Não migrar nada pra D1. Banco = Supabase.

Sessão = zerar P0 (o que for código) e o próximo item da P1, um PR.
Não inventar item. Não reabrir ADR-9 fase 2. Não portar Ansvisor.
Feito → marca [x] no BACKLOG e uma linha no DECISOES.md no mesmo PR.
```
