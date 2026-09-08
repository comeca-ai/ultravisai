# STATUS — visão de 1 página

> **Pra que serve:** quando estiver perdido, olhe SÓ este arquivo. Resumo do
> estado da aplicação, atualizado a cada sessão de trabalho relevante.
> Detalhes: `CONTEXTO.md` (história completa) · `DECISOES.md` (toda decisão) ·
> `BACKLOG.md` (o que vem). **Atualizado: 08/set/2026.**

## ✅ 08/set: auditoria de segurança completa — 7 de 9 P0/P1 corrigidos

Rodada `/auditor-de-codigo` completa (8 caçadores + verificação adversarial).
Achados e correções em `AUDITORIA.md` (raiz do repo). Resumo:

- **Corrigido e no ar (PRs #156, #157, todos mergeados em `main`):**
  IDOR em `GET /api/content/brand/:brandId` (vazava dado de conteúdo entre
  organizações) · SSRF em `POST /api/content/webhook-test` e em
  `POST /api/brands/describe-from-site` · **P0 real**: 5 policies de RLS em
  `prompt_results`/`ai_traffic_logs`/`prompt_result_shopping_cards` sem
  `TO service_role` deixavam a **anon key pública apagar/forjar dado de
  produção sem login** (migration `00047`) · IDOR de billing em
  `POST /api/stripe/checkout` (sequestro de assinatura entre organizações) ·
  corrida de idempotência no `/cloro/callback` (duplicava métricas) · deploy
  não esperava o CI (novo job `check-ci`, **testado em produção nesta mesma
  sessão — funcionou**: bloqueou o `deploy` até o CI do mesmo commit fechar
  verde).
- **Deferido, não é fix de código:** suíte de teste de isolamento RLS entre
  organizações (proposta no roadmap de `AUDITORIA.md`) e ligar os canais de
  alerta do watchdog (pendência nº 1 abaixo, precisa de credencial real no
  painel).
- Também mergeadas hoje: 4 PRs do Dependabot já avaliados como seguros
  (#140, #143, #144, #147 — patch/minor, checks verdes). Os 6 restantes
  (bumps major) e o PR #146 continuam sem revisão manual — não mergear sem
  testar.

**🔴 Atualização (mesma tarde): 4 dos PRs "não mergear sem testar" foram
mergeados assim mesmo** (#139 `ai`, #142 `@ai-sdk/openai`, #145 `@types/node`,
#148 `@ai-sdk/react`) — o `check-ci` funcionou de novo e travou o deploy
corretamente, mas o CI ficou vermelho: `@ai-sdk/react@4.0.96` exige Node ≥22,
e tanto o runner do CI quanto `server/Dockerfile` (produção) usam Node 20.
Revertidas as 4 bumps (`git revert`, branch `fix-ci-ai-sdk-node20`) — não é
código quebrado, é infraestrutura incompatível; qualquer bump desses precisa
vir junto com upgrade de Node em CI + Dockerfile, decisão maior que não cabe
num merge automático. PR #146 (fix de UI, não-bump) não foi tocado — sem
relação com a quebra. Também achado no mesmo lote: `schema.sql` e 2 arquivos
sem `prettier` ficaram defasados por um merge de PR antigo baseado em `main`
desatualizado (mesma causa-raiz do achado do `STATUS.md` — ver `DECISOES.md`).

## 🔴 INCIDENTE ABERTO (08/set): 401 em 5 telas (auditoria, citabilidade,
conteúdo, tópicos, prompts) — hipótese forte, precisa do dono pra confirmar

Investigação nesta sessão chegou a uma hipótese concreta mas não conseguiu
confirmar: a conta Supabase que este ambiente enxerga (via MCP) tem **3
projetos distintos**, e nenhum deles bate com a produção documentada
(`twhqjfbealruvcbvkegc`, inacessível daqui). Dois projetos visíveis: um
pausado, e um projeto vazio/upstream sem uso (`kepunaqlwhpbmtrcoscx` — 44
migrations aplicadas mas **sem** a coluna `appearance_rivals` nem as tabelas
`index_weights`/`brand_archives` do fork, ou seja, é uma instalação Ansvisor
upstream nunca customizada, não a Ultravis). Hipótese: o `SUPABASE_URL`
configurado no painel do worker Cloudflare (`ultravis-server` → Settings →
Variables and Secrets) pode estar apontando pra um projeto errado — o que
explicaria 401 em telas que dependem de RPC/tabelas específicas do fork.

**O que só o dono consegue fazer:** abrir `ultravis.ai` logado, DevTools →
Application → Cookies, achar o cookie `sb-<ref>-auth-token` (o `<ref>` é o id
do projeto Supabase que o **navegador** está usando pra login) e comparar
esse `<ref>` com o valor de `SUPABASE_URL` nas vars do worker no painel
Cloudflare. Se forem diferentes, achamos a causa-raiz. Não dá pra ler o
valor de `SUPABASE_URL` do worker por nenhum caminho disponível nesta sessão
(é Secret, não aparece em log/diff).

## ✅ RESOLVIDO (08/set, fim da tarde): deploy do server destravado — run #38 sucesso

Sequência completa da novela do token, pra quem chegar depois: token sem
`Workers Scripts: Edit` (runs #14–#37) → token custom recriado com as 3
permissões certas (Workers Scripts + D1 + Workers Routes, todas Edit) →
valor colado em chat por engano → Roll pedido → **valor pós-Roll saiu
quebrado** (2 tentativas seguidas, runs #36 e #37, falharam com
`Invalid API Token`/`Unable to get membership roles` — o secret tinha
valor inválido, não só permissão faltando) → dono reconferiu o valor pela
3ª vez → **run #38 (24c2f58) passou: deploy + build da imagem (container
non-root novo) + smokes, tudo verde.** `api.ultravis.ai` está rodando o
código de hoje (leva de segurança P2 + a correção do próprio deploy).

Lição pro próximo token que vazar: depois de um Roll, o valor precisa ser
copiado nesse exato momento (só aparece uma vez) — colar um valor truncado
ou o antigo por engano dá o MESMO sintoma de "sem permissão" (Authentication
error / Unable to get membership), então não dá pra distinguir só pelo log;
foi preciso reconferir campo a campo.

Histórico do bloqueio original (07-08/set), três sintomas de token, todos
resolvidos:

| Sintoma | O que era | Estado |
|---|---|---|
| `Invalid format ... [6111]` | o secret tinha o **ID** do token (UUID), não o valor | ✅ resolvido |
| `Unable to get membership` (bloqueio original) | token de conta em vez de usuário | ✅ nunca ocorreu (token é de usuário) |
| `Authentication error [10000]` no `PUT /workers/scripts` | faltava `Workers Scripts: Edit` | ✅ resolvido (token recriado) |
| `Invalid API Token` (novo, pós-Roll, runs #36-37) | valor colado errado/incompleto em GitHub Secrets | ✅ resolvido (run #38) |

**Achado que o bloqueio escondia (run #19, ainda válido):** o wrangler
planejava **apagar** o Custom Domain `api.ultravis.ai` — criado à mão no
painel em 06/set e nunca versionado. Corrigido no #137 (`routes` no
`wrangler.jsonc`); `keep_vars` protege variáveis, não rotas.

**Segundo achado (ainda válido):** `OPS_USER`/`OPS_PASS` estão no painel como
**var de texto** (valor fraco), então aparecem em claro no diff que o
wrangler imprime no log do CI. São a senha do `/ops` e do `/espelho`.
Correção é no painel — ver "Pendências SUAS" (item 0b).

**Achado que o bloqueio escondia (run #19):** o wrangler planejava **apagar**
o Custom Domain `api.ultravis.ai` — criado à mão no painel em 06/set e nunca
versionado. O primeiro deploy bem-sucedido teria derrubado a API inteira sem
erro no log. Corrigido no #137 (`routes` no `wrangler.jsonc`); `keep_vars`
protege variáveis, não rotas.

**Segundo achado:** `OPS_USER`/`OPS_PASS` estão no painel como **var de
texto** (valor fraco), então aparecem em claro no diff que o wrangler imprime
no log do CI. São a senha do `/ops` e do `/espelho`. Correção é no painel —
ver "Pendências SUAS".

## ⚠️ INCIDENTE (06/set): rastreamento parado há 13 dias

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
| Server de rastreamento (Railway) | ⬛ **APAGADO em 06/set à noite** (trial expirado; dono removeu após o corte) |
| **Server no Cloudflare (Container)** | ✅ **Destravado 08/set (run #38)** — `api.ultravis.ai` rodando o código de hoje (leva de segurança P2 + container non-root). Deploy volta a ser automático em todo merge tocando `server/**`/`cloudflare/server-container/**`. Ainda não confirmado: se a ponte do censo pro D1 já publicou os números do censo de 07-08/set (depende de rodar depois do deploy) |
| **Workers na conta** | ✅ **UM só desde 07/set** (`ultravis-server`) e **um pipeline** (`deploy-server-container`): o espelho D1 virou a rota `/espelho` do mesmo worker. `/espelho` **já exige HTTP Basic** e responde 503 se as credenciais faltarem (fechado por omissão) — o smoke do deploy exige 401 no anônimo. ⏳ Os dois órfãos (`ultravis-edge-gateway`, `ultravis-d1-espelho`) ainda **não** foram apagados: o workflow `limpar-workers-orfaos` existe mas está travado (`ARMADO: 'nao'`) |
| Banco (Supabase) | ✅ Ok — 48 migrations (numeradas até 00048; a 00007 não existe), RLS ativo, **arquivo-morto de marcas** ligado. GRANT ALL residual revogado em 3 tabelas server-only (migration 00048, 08/set) |
| Watchdog (vigia interno, 15 em 15 min) | ✅ Rodando, 6 checks de saúde **+ 11 invariantes de consistência** (19/ago + 26/ago: duplicatas, marcas irmãs, motor silencioso, contas que não fecham, domínios quebrados/com caminho) — 2 alertas que gritavam em falso corrigidos em 26/ago (**na branch, sobem com o PR #95**); alertas por e-mail **desligados** até você configurar um e-mail dedicado. **Camada 2 pronta na branch `vigia-camada2-llm`** (agente LLM semanal pós-censo, 1 chamada/rodada; liga com `CONSISTENCY_LLM_MODEL` ou `AUDIT_LLM_MODEL` no worker) |
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
| Saúde do server / logs | Cloudflare → Workers e Pages → `ultravis-server` → aba **Logs** (stdout do container) e Containers (instâncias) · painel `/ops` em api.ultravis.ai/ops (jobs e rastreamentos) |
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

0. 🔴 **`Workers Scripts` de Read → Edit** no token (dash.cloudflare.com/profile/api-tokens → seu token → Edit). Marcar também `Zone → Workers Routes: Edit` (Custom Domain) e `D1: Edit` (schema do espelho). **Não** clicar em Roll — o valor mudaria e teria que recolar no GitHub. Isto destrava, em cadeia: worker consolidado, `/espelho` autenticado, schema D1, ponte do censo e os números da Polar.
0b. 🔒 **Trocar `OPS_USER`/`OPS_PASS`**: apagar as duas **vars de texto** no painel do worker, cadastrar em GitHub → Secrets → Actions com valor novo e forte, rodar `sync-cf-secrets` (grava como Secret, some do diff e do log).
1. **E-mail dedicado de operação** → depois setar `ALERT_EMAIL_TO` + `SMTP_USER`/`SMTP_PASS` no Railway (liga os avisos do watchdog).
2. **`ANTHROPIC_API_KEY`** em GitHub → Settings → Secrets → Actions (liga o agente da auditoria; ~R$ 3–10/mês).
3. **Criar `contato@ultravis.ai`** (Cloudflare Email Routing, grátis) — é o canal LGPD das páginas de Termos/Privacidade.
4. Decidir: logado → home ou dashboard (item #23 do feedback).
0c. 🔒 **Rotacionar 2 credenciais coladas em chat nesta sessão** (nunca usadas
    nem commitadas por mim, mas o valor apareceu na conversa): a **Cloro API
    key** (`sk_live_...`, painel do Cloro) e o token Cloudflare mencionado
    antes. Gerar novo valor no painel de origem e colar só lá/no GitHub
    Secrets — nunca de volta aqui.
0d. **Decidir os PRs em draft que ainda dependem de você**: #152/#153/#154
    (mudanças de produto — pesos do Score, ranking unificado — aguardando
    sua revisão) e os 6 PRs do Dependabot com bump major (#138, #139, #141,
    #142, #145, e #146) — não mergear sem testar manualmente.
0e. ✅ **Token Cloudflare — saga fechada (08/set, run #38 sucesso).** Resumo:
    token custom criado (Workers Scripts + D1 + Workers Routes Edit) → vazou
    em chat → Roll pedido → 2 recolagens quebradas em GitHub Secrets (runs
    #36/#37, `Invalid API Token`) → 3ª reconferência funcionou (run #38).
    Histórico completo na seção "RESOLVIDO" no topo deste arquivo.
    Achado também nesta sessão: o repositório foi renomeado de `ansvisor`
    pra **`ultravisai`** (mesma org `comeca-ai`) — atualizar qualquer
    referência antiga ao nome `ansvisor` em bookmarks/scripts locais.
5. **Comparar `SUPABASE_URL` do worker com o cookie de login do site** — ver
   o incidente de 401 acima; é o único jeito de confirmar a causa.

## Próximo trabalho de produto

**Citabilidade v2** — recomendações com código pronto pra copiar (llms.txt, schema, FAQ, metatags). O pedido ⭐ do cliente. Depois: histórico do IC (#10) e UI de aliases.
