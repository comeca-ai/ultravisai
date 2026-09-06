# STATUS — visão de 1 página

> **Pra que serve:** quando estiver perdido, olhe SÓ este arquivo. Resumo do
> estado da aplicação, atualizado a cada sessão de trabalho relevante.
> Detalhes: `CONTEXTO.md` (história completa) · `DECISOES.md` (toda decisão) ·
> `BACKLOG.md` (o que vem). **Atualizado: 06/set/2026.**

## ⚠️ INCIDENTE ABERTO (06/set): rastreamento parado há 13 dias

O censo de segunda 31/ago **rodou no horário e coletou ZERO resultados** (as 8
marcas, `resultCount: 0`). Causa dupla, provada nos logs de 06:00 UTC:
1. **Cloro sem créditos** — todo submit de scraper falhou com
   `403 INSUFFICIENT_CREDITS` (chatgpt-web, perplexity, copilot, google-aimode…);
2. **Claude 401** — a mesma `ANTHROPIC_API_KEY` inválida desde 8/ago (31
   falhas só nessa hora).

Correção (ordem INVERTIDA em 06/set): **primeiro o corte pro Cloudflare,
DEPOIS recarregar o Cloro** — as chaves agora vivem no worker E no Railway,
e recarregar antes do corte criaria risco de censo duplo. A chave nova da
Anthropic já está no worker do Cloudflare. Créditos de outras plataformas (ex.: Cloudflare) NÃO
substituem: o produto mede os motores reais (ChatGPT/Gemini/Claude), que só
saem via Cloro (interfaces web) e via chave da Anthropic (API). O vigia acusou
certo (`tracking-silent`), mas o alerta ficou só no log — o e-mail de operação
desligado é a pendência nº 1 e este incidente é o argumento definitivo.

## A aplicação está no ar e saudável ✅

| Camada | Estado |
|---|---|
| Site + app (Vercel, ultravis.ai) | ✅ No ar com o código de 19/ago (#94); a leva 26–29/ago espera o merge do PR #95 |
| Server de rastreamento (Railway) | ✅ No ar (deploy de 18/ago), mas **trial expirado = sem deploy novo** — é o endereço oficial (`api.ultravis.ai`) só até o corte |
| **Server no Cloudflare (Container)** | ✅ **NO AR desde 06/set 20:46 UTC** (https://ultravis-server.jhonata-emerick.workers.dev, HTTP 200) — mesmo código, 10 segredos no worker, deploy auditado via Actions; aguarda o corte de DNS fora da janela de censo |
| Banco (Supabase) | ✅ Ok — 43 migrations (numeradas até 00044; a 00007 não existe), RLS ativo, **arquivo-morto de marcas** ligado |
| Watchdog (vigia interno, 15 em 15 min) | ✅ Rodando, 6 checks de saúde **+ 11 invariantes de consistência** (19/ago + 26/ago: duplicatas, marcas irmãs, motor silencioso, contas que não fecham, domínios quebrados/com caminho) — 2 alertas que gritavam em falso corrigidos em 26/ago (**na branch, sobem com o PR #95**); alertas por e-mail **desligados** até você configurar um e-mail dedicado |
| Auditoria diária de código (GitHub, 09:00 UTC) | ✅ Corrigida em 11/ago (etiqueta faltante); 1ª issue esperada em 12/ago ~06:00 BRT. Custo: ~R$ 0 (agente Claude desligado até a `ANTHROPIC_API_KEY`) |

## O cliente piloto (Polar) — números reais

- **Share of Voice 6,7%** (163 menções vs 2.262 dos concorrentes; Garmin domina com 1.096)
- Aparece em **10 de 15 prompts** (Índice de Visibilidade 66,7%) · sentimento: 27 positivos, 2 negativos
- Era tudo zero por bug de matching de nome → resolvido com **aliases de marca** + reprocessamento (10/ago)

## O que aconteceu desde 19/ago (resumão)

0. **26–29/ago — verificação, revisão geral e limpeza (PR #95, draft, NÃO deployado de propósito):**
   (a) **Verificação de produção 26/ago** (`docs/verificacao-26ago.html`): 21/21 entregas conferidas na main, fórmulas reconciliadas SQL→action→tela; lendo os logs 22–26/ago descobrimos que **2 alertas do vigia gritavam em falso** — corrigidos (`sentiment-degraded` agora só conta respostas COM menção; `bad-domains` virou `broken-domains`+`pathed-domains`);
   (b) **Retrospectiva das 90 decisões** (`docs/retrospectiva-decisoes.html`) e **skill material-visual** empacotada (`estrategia/skills/`) — padrão dos materiais visuais com carimbo vNN;
   (c) **Revisão geral de 29/ago** (pedido do dono): 167 pedidos extraídos de transcrição+decks+reuniões cruzados com o código + 87 contas conferidas em todas as camadas — relatório em `docs/revisao-geral-29ago-v1.html`; consertados no ato: **fórmula do hero do Score** (imprimia pesos brutos, mas o valor usa renormalizados — a equação não somava), STATUS/contagens defasadas, última string "Ansvisor" visível (en), aria da sparkline com nome antigo do índice, e **~25 strings hardcoded em inglês** nas telas Insights e Auditoria (agora i18n nos 2 idiomas);
   (d) **Bloco "Recomendações" removido do fim do Insights** (pedido do dono 29/ago).
   ⚠️ Produção ainda roda o código de 19/ago: os fixes acima só valem depois do merge do PR #95.

## O que aconteceu até 19/ago

1. **19/ago — o dia da reunião Igor×Jhonata virou produto (11 PRs, #82–#92):**
   (a) **Vigia de consistência** no watchdog — 10 invariantes (duplicatas, marcas irmãs, motor calado, contas que não fecham, recontagem independente), nascidos dos 5 bugs pegos à mão na semana; auditor verificou o executado e 6 achados da revisão completa foram corrigidos no mesmo dia;
   (b) **Taxonomia da reunião nas telas**: Citação→**Leitura**, Posição→**Ranking**, zonas do IC viram a matriz **você controla · ativa · conquista**, briefs com as definições ditadas nos post-its;
   (c) **Resumo do Insights redesenhado**: 3 números sem nota ponderada — Presença **22,2% (12 de 54 prompts)**, Ranking médio (#2,3 + distribuição) e Sentimento overall; Menções/Citações saíram do resumo; fan-out explicado; migration 00044 estende o RPC com os mesmos filtros;
   (d) **Sentimento com fontes**: placar por motor + "onde falam de você" (top 10 domínios com +/~/−);
   (e) **"O que fazer" da Auditoria orientado por evidência** (premissa v2: ler → diagnosticar → indicar; JSON-LD primeiro) — 8 sinais com indicação específica do que foi lido do site;
   (f) **Ata de decisões Jhonata×Igor** versionada (`estrategia/ata-decisoes-jhonata-igor.md`, 4 sessões, ~30 decisões com evidência) + **13 arquivos dos sócios** em `estrategia/recebidos/` + **wireframe dos processos** (`docs/processos-wireframe.html` + artifact).
   Pendências do dono: `ANTHROPIC_API_KEY` no Railway (Claude), ticket Cloro (Grok — o upstream shipou guarda pro mesmo problema, candidata a port), e-mail do Igor pro acesso ADM.
2. **Sessão da noite de 18/ago (com o dono ao vivo):** (a) **Posição por ordem de aparição** — premissa aprovada em sessão: a dimensão Posição do Score rankeia pela ordem da 1ª menção no texto (nota B: 1º=100 · 2º=60 · 3º=30 · 4º+=0); histórico retroativo calculado — Polar é 1ª citada em 39% das respostas em que aparece; (b) **tabela Motores × Pacotes** (4/6/9) versionada em config + card no /ops; (c) **bug do gráfico Marca vs Concorrentes >100% corrigido** — Garmin estava duplicado e o gráfico somava homônimos; validado ≤100% por motor; (d) **diagnóstico dos motores fantasma fechado ao vivo**: Claude parado desde 8/ago por `ANTHROPIC_API_KEY` inválida no Railway (401 — trocar a chave resolve, pendência do dono) e Grok falha 100% no lado do Cloro (abrir ticket, pendência do dono).
3. **Fila aprovada em execução (18/ago):** itens 1 e 2 prontos — **prompts de marca** (PR #65: 4 perguntas × 8 marcas; share Direto × Orgânico começa a contar no próximo censo) e **coletor direto de reviews** (PRs #66-#71: Trustpilot/G2/Capterra checados semanalmente via Scrape.do; D4 deixou de ser proxy). 1ª varredura real: Polar com Trustpilot **1,4★/709 avaliações** + G2 + Capterra (D4=40); Polar Electro D4=20; demais marcas ausência confirmada (D4=10). Reclame Aqui "não verificável" (bloqueia até proxy residencial) — configurar DataForSEO no Railway ativa a saída via SERP já implementada. Também no ar: **calibração de pesos do IC no /ops** (PR #64) e **botão Parar consertado** (PR #63). Próximos da fila: varredura multi-página do site (D1) e página do Score de Visibilidade.
4. **Incidente resolvido (17/ago):** o site web esteve congelado no build de 8/ago — a integração Vercel×GitHub morreu quando o repo antigo foi deletado, e nenhum merge chegava ao ar (por isso "o inglês voltou"). Reconectado; deploy atual serve tudo acumulado, incluindo o Índice de Visibilidade v2. Próximo passo: check de drift de deploy no watchdog (BACKLOG P1).

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
