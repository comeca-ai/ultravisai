# BACKLOG — Ultravis

> Fila viva. **Atualizado: 10/set/2026.**
> Sessão = ajustes dos diretores + validar métricas. Sem migração D1.

## Como ler

- `P0` agora · `P1` próximo · `P2` estoque (não abrir)
- `[x]` some da P0/P1 na sessão seguinte

---

## ⛔ Não fazer

- Migrar Supabase → D1, dual-write, Hyperdrive, worker novo, “fase B/C”
- Fase 2 do ADR-9 · portar Ansvisor sem `DECISOES.md` · colar segredo em chat
- Reabrir item da ata marcado ✅
- Recolocar Autoridade/Acurácia no Score (4.1: saem até existir juiz LLM)

---

## P0 — sessão: diretores + métricas

Fontes, nesta ordem: ata · `ajustar.md` · regras MET-* · revisão 29/ago.

### A. Ajustes ainda abertos que os diretores pediram (código)

| # | Pedido | Fonte | O que fazer |
|---|---|---|---|
| A1 | **Uma conta de Score, não três** | DIV-04, ata 4.1/4.5, `ajustar.md` | Insights, Score e hero têm que contar a mesma coisa ou a tela tem que dizer por que não. Código, não slide novo. |
| A2 | Clique `#2,3` (Ranking médio) **não pode cair numa nota 45 sem explicação** | `ajustar.md` parte 1 | São escalas diferentes (média vs pódio). Texto na tela + destino do clique. |
| A3 | Vigia: **100% em 1º lugar** (amostra ≥10) = olhar o motor | ata 4.7 | Check em `consistency.js` |
| A4 | Auditoria: **rendering** (HTML cru vs renderizado) e **idioma/país** (`lang`/`hreflang`) | ata 4.10, checklist Igor | Completar 6/8 → 8/8 sinais |
| A5 | Citabilidade v2: **tela entrega o kit** (llms.txt, JSON-LD, FAQ) pra copiar | pedido ⭐ Polar, kit já no server | UI, não motor novo |
| A6 | Landing **não vender** 150 prompts × 4 motores se o código entrega 50 × 2 | DIV-01 | Copy ou gate — os dois têm que bater |

Não é desta sessão (⏳ sócio, não código): nome “citabilidade” (4.15),
acesso ADM do Igor (4.8), 9º motor (2.10), onboarding matriz (4.12 — dono
adiou), e-mail do Daily Pulse (2.8).

### B. Validar todas as métricas (prova, não opinião)

Para **cada** MET-01…MET-11 em `docs/regras-de-negocio-09set-v01.html`:

1. Ler a regra e o arquivo citado em `e:`.
2. Recalcular no SQL com Polar Electro (janela 30d, sem shopping).
3. Conferir o número na action e na tela.
4. Marcar **passa / falha / divergência** (ata diz X, código faz Y).

Entregar `docs/validacao-metricas-10set.html` (mesmo espírito de
`docs/verificacao-26ago.html`). Corrigir falha no mesmo PR quando for
bug. Divergência de desenho (DIV-05…14) vai pra tabela do relatório —
não “conserta” a ata.

Cuidado: **MET-10 está defasada.** Citação desde 09/set = link que traz
o produto, de qualquer fonte (`contarCitacoesDoProduto`, 00049) — não
“domínio próprio”. Validar o código + `DECISOES.md` 09/set.

Régua de sentimento 100/50/0 (ata 4.6) = **medir com Polar e reportar**,
não trocar sozinho.

---

## P0-ops — só o dono (não trava o A/B)

| # | Item |
|---|---|
| 1 | Token CF antes de 13/set, só no GitHub Secret; revogar o vazado |
| 2 | Conferir Actions `limpar-workers-orfaos` verde |
| 3 | `OPS_USER`/`OPS_PASS` → Secret + `sync-cf-secrets` |
| 4 | Um canal do watchdog (`ALERT_WEBHOOK_URL` ou SMTP) |
| 5 | `SUPABASE_URL` do worker vs cookie `sb-<ref>-auth-token` |
| 6 | Secrets `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` no repo (`verificar-censo`) |
| 7 | Merge [PR #193](https://github.com/comeca-ai/ultravisai/pull/193) |
| 8 | `consolidar-polar.sql` no SQL Editor do projeto certo |

---

## P1 — depois de A+B verde

1. UI de aliases (00036). Polar Electro.
2. Onboarding: Brazil → `pt`; ETA em tópicos; marca rascunho até o fim.
3. Gráfico escala (#14) — print do Igor.
4. MCP `tools/list` com key real.

---

## P2 — estoque

Insights v3, IC sinais extra, pacotes 15/20/30k, GSC/GA4, ADR-9 fase 2,
recontar citações (`aplicar=nao` primeiro).

---

## Decisões do dono (não inventar)

- Recalcular citações no histórico ou só daqui pra frente
- Pricing / `IS_CLOUD=true`
- DIV-02, DIV-03 e as 4 graves em `regras-de-negocio-09set-v01.html`
- Nota composta 0–100 na página Score (ata §pendência 6)

---

## Prompt pra colar no início da sessão

```
Leia CLAUDE.md, BACKLOG.md e estrategia/ata-decisoes-jhonata-igor.md.

Não migrar nada pra D1. Banco = Supabase.

Sessão:
1) Finalizar os ajustes que os diretores pediram nas reuniões
   (BACKLOG P0-A). Fonte = ata + ajustar.md. Não inventar pedido.
2) Validar todas as métricas criadas (MET-01…11): SQL → action → tela,
   Polar Electro. Entregar docs/validacao-metricas-10set.html.
   Falha de código = corrige no mesmo PR. Divergência de desenho = reporta.

Um PR por entrega. Feito → [x] no BACKLOG + linha no DECISOES.md.
Não reabrir ADR-9 fase 2. Não portar Ansvisor. Não recolocar
Autoridade/Acurácia no Score.
```
