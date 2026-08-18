# STATUS — visão de 1 página

> **Pra que serve:** quando estiver perdido, olhe SÓ este arquivo. Resumo do
> estado da aplicação, atualizado a cada sessão de trabalho relevante.
> Detalhes: `CONTEXTO.md` (história completa) · `DECISOES.md` (toda decisão) ·
> `BACKLOG.md` (o que vem). **Atualizado: 18/ago/2026.**

## A aplicação está no ar e saudável ✅

| Camada | Estado |
|---|---|
| Site + app (Vercel, ultravis.ai) | ✅ No ar e ATUALIZADO (17/ago) — esteve congelado em build de 8/ago por integração GitHub quebrada na migração do repo; reconectada em 17/ago |
| Server de rastreamento (Railway) | ✅ No ar (último deploy SUCCESS, 18/ago) |
| Banco (Supabase) | ✅ Ok — 41 migrations, RLS ativo, **arquivo-morto de marcas** ligado |
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
10. **Painel /ops ganhou Saúde (watchdog ao vivo) + Clientes × Marcas** (PR #47) — acesso: `api.ultravis.ai/ops` (credenciais `OPS_USER`/`OPS_PASS` no Railway).
11. **Bugs #28/#29/#30 resolvidos** (PR #48): rebranding residual completo (agente, nomes de export `ansvisor_*`, /pricing indo pro site do upstream, mailto de vendas), relatório não aborta mais quando o resumo por IA falha (causa do "relatório não gerado"), login honra `redirectTo`. **18 de 30 itens do feedback respondidos.**
12. **Índice de Visibilidade v2 no ar (15/ago)** — a tela "Citabilidade" virou **Índice de Visibilidade** (decisão da reunião de 14/ago com o Igor): as 6 dimensões sempre têm nota, a fórmula aparece aberta e a conta fecha, cada card mostra breve explicação + evidências + **fontes pesquisadas** (incluindo o que não lemos, declarado), a "visibilidade" antiga virou "share de resposta nos prompts" com linha de conferência, e há botão "Copiar llms.txt pronto". Réguas v1 calibradas com dados reais (citação própria máx. 7,4%; review ≈ 0 nas citações → checagem direta na fase 2). Pauta de segunda 15h: doc de lógica do Igor calibra pesos e réguas.
13. **Sessão da noite de 18/ago (com o dono ao vivo):** (a) **Posição por ordem de aparição** — premissa aprovada em sessão: a dimensão Posição do Score rankeia pela ordem da 1ª menção no texto (nota B: 1º=100 · 2º=60 · 3º=30 · 4º+=0); histórico retroativo calculado — Polar é 1ª citada em 39% das respostas em que aparece; (b) **tabela Motores × Pacotes** (4/6/9) versionada em config + card no /ops; (c) **bug do gráfico Marca vs Concorrentes >100% corrigido** — Garmin estava duplicado e o gráfico somava homônimos; validado ≤100% por motor; (d) **diagnóstico dos motores fantasma fechado ao vivo**: Claude parado desde 8/ago por `ANTHROPIC_API_KEY` inválida no Railway (401 — trocar a chave resolve, pendência do dono) e Grok falha 100% no lado do Cloro (abrir ticket, pendência do dono).
14. **Fila aprovada em execução (18/ago):** itens 1 e 2 prontos — **prompts de marca** (PR #65: 4 perguntas × 8 marcas; share Direto × Orgânico começa a contar no próximo censo) e **coletor direto de reviews** (PRs #66-#71: Trustpilot/G2/Capterra checados semanalmente via Scrape.do; D4 deixou de ser proxy). 1ª varredura real: Polar com Trustpilot **1,4★/709 avaliações** + G2 + Capterra (D4=40); Polar Electro D4=20; demais marcas ausência confirmada (D4=10). Reclame Aqui "não verificável" (bloqueia até proxy residencial) — configurar DataForSEO no Railway ativa a saída via SERP já implementada. Também no ar: **calibração de pesos do IC no /ops** (PR #64) e **botão Parar consertado** (PR #63). Próximos da fila: varredura multi-página do site (D1) e página do Score de Visibilidade.
15. **Incidente resolvido (17/ago):** o site web esteve congelado no build de 8/ago — a integração Vercel×GitHub morreu quando o repo antigo foi deletado, e nenhum merge chegava ao ar (por isso "o inglês voltou"). Reconectado; deploy atual serve tudo acumulado, incluindo o Índice de Visibilidade v2. Próximo passo: check de drift de deploy no watchdog (BACKLOG P1).

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
