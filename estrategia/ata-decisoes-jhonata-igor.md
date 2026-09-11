# Ata de decisões — Jhonata × Igor

> Registro consolidado, em ordem cronológica, das decisões de produto e método
> **aprovadas entre os dois sócios** ao longo do tempo. Fontes: transcrição da
> reunião de 14/ago, docs de lógica v260817 (planilha 4 abas + PPT 9 slides),
> sessão conjunta de 18/ago, WorkSession de 19/ago (transcrição ~58 min +
> deck v19/ago com post-its). O log técnico completo continua em
> `DECISOES.md`; esta ata é o recorte societário — o que os dois combinaram,
> quando, e onde está implementado.
>
> Status: ✅ implementado · 🔨 em implementação · 📋 backlog priorizado ·
> ⏳ pendência de um dos sócios. Atualizada em 19/ago/2026.

---

## Sessão 1 — Reunião de 14/ago (registrada 15/ago)

A reunião que redefiniu o core do produto.

| # | Decisão | Status |
|---|---|---|
| 1.1 | O índice central passa a se chamar **"Índice de Visibilidade"** — "citabilidade parece sofisticado, difícil" | ✅ (nomenclatura evoluiu na sessão 2 — ver 2.1) |
| 1.2 | As 6 dimensões **sempre têm nota** — fim do "35% medido" | ✅ |
| 1.3 | Toda nota responde três perguntas: **por quê · onde olhamos · o que fazer** | ✅ (cards com critérios, evidências e fontes visíveis) |
| 1.4 | **A matemática fecha na frente do cliente** — fórmula aberta, linha de conferência | ✅ (princípio permanente; gerou depois o vigia de consistência) |
| 1.5 | A "visibilidade" antiga vira **"share de resposta nos prompts"** — componente, não índice | ✅ |

## Sessão 2 — Docs de lógica do Igor + sessão de 17/ago

Materiais: planilha v260817 (4 abas) + PPT (9 slides). Regra aplicada:
"use as decisões do registro; o que não tem registro fica em aberto".

| # | Decisão | Status |
|---|---|---|
| 2.1 | **Arquitetura de DOIS índices que não se somam**: Índice de Citabilidade (alavanca — o que você constrói) **dirige** o Score de Visibilidade (resultado — como a IA te mostra). Somar seria contar causa e efeito na mesma conta | ✅ (páginas separadas, nota de reconciliação em ambas) |
| 2.2 | Score de Visibilidade com 6 dimensões próprias: Citação 20 · Presença 20 · Autoridade 20 · Posição 15 · Acurácia 15 · Sentimento 10 | ✅ como registro; composição revista na sessão 4 (ver 4.1) |
| 2.3 | **Faixas de nota em quintis** (0-20 / 21-40 / 41-60 / 61-80 / 81-100), compartilhadas entre IC e Score | ✅ |
| 2.4 | **Pesos-prior do IC**: 22/20/18/15/13/12 (Open Media · Conteúdo · Reviews · Legibilidade · Verticais · Social), sujeitos a calibração por regressão quando houver histórico | ✅ (calibráveis pelo /ops sem deploy) |
| 2.5 | Núcleo de plataformas de review: **G2, Trustpilot, Capterra, Reclame Aqui, Google** (+ Reddit/Quora na camada seguinte) | ✅ coletor semanal no ar (Google Reviews 📋 — API paga) |
| 2.6 | D5 (Mídia Aberta) usa **todos os domínios citados ponderados por frequência** — sem top-N fixo | ✅ |
| 2.7 | **Prompts de marca** para separar SoV Direto × Orgânico (feature dos 3 pacotes) | ✅ (32 prompts semeados, recorte na tela) |
| 2.8 | Alertas de variação **±5 pontos semanais**, e-mail primeiro | ✅ código (Daily Pulse) · ⏳ Jhonata: e-mail dedicado para ligar o envio |
| 2.9 | **Pacotes comerciais Sinal / Alcance / Domínio — R$ 15/20/30 mil** | 📋 gate por plano; base técnica pronta (ver 3.2) |
| 2.10 | **9 motores** conforme a lista dos pacotes; DeepMind/Minimax só viram promessa após validação técnica | 🔨 6 entregando · ⏳ Claude (chave) e Grok (Cloro) · 📋 9º slot |

## Sessão 3 — Sessão conjunta de 18/ago

| # | Decisão | Status |
|---|---|---|
| 3.1 | **Premissa da Posição: ordem de aparição, não volume** — "quem foi mencionado primeiro, segundo, terceiro; não quantas menções". Distribuição 1º/2º/3º/4º+ visível; nota B (pódio 100/60/30/0) escolhida entre as opções A e B | ✅ (validada ao vivo na sessão 4: Polar = 49 na tela) |
| 3.2 | **Tabela Motores × Pacotes** (CSV): 4 motores = ChatGPT + AI Overviews + Gemini + AI Mode · 6 = + Copilot + Perplexity · 9 = + Claude + Grok + slot aberto. Cliente ainda não vê tags — base do futuro gate | ✅ config versionada + tabela no /ops |
| 3.3 | Score de Visibilidade combinado em duas contas: **percentual de respostas + ranking** (referido pelo Igor na sessão 4 como "combinamos duas coisas ontem") | ✅ absorvido pela taxonomia final da sessão 4 |

## Sessão 4 — WorkSession de 19/ago (transcrição + deck com post-its)

A sessão da taxonomia. Padronização pedida pelo Igor: "palavras e títulos
claros que significam uma condição só".

### Taxonomia e composição

| # | Decisão | Evidência | Status |
|---|---|---|---|
| 4.1 | **Autoridade e Acurácia saem do Score** até existir medição (juiz LLM): "a autoridade e a acurácia a gente está tirando" | 50:26 | ✅ (4 dims renormalizadas) |
| 4.2 | **"Citação" → "Leitura"**: "como minhas fontes proprietárias são lidas pela IA... talvez o melhor nome aqui seja leitura mesmo" | 56:40–58:12 · deck slides 5-7 | ✅ |
| 4.3 | **"Posição" → "Ranking"** ("ranking médio") | 47:12 · 55:24 | ✅ |
| 4.4 | Presença = "em que % das respostas apareço"; Sentimento = "como os clientes/consumidores **avaliam** a minha marca" — definições ditadas viram o texto dos cards | 53:47–54:28 · post-its P2 | ✅ |
| 4.5 | **Resumo de visibilidade (Insights) mostra 3 coisas, sem nota ponderada**: presença como "X de N prompts", ranking médio (com distribuição #1..#4+) e sentimento overall (positivo/neutro/negativo + placar) — "eu não preciso ter uma nota ponderada disso"; Menções e Citações saíram do resumo ("não queria ficar com muito número", 36:40) | 42:22–42:55 · 35:58–37:42 | ✅ (migration 00044) |
| 4.6 | **Sentimento traz as fontes** — "ele quer saber onde estão falando mal dele, para ele atuar"; régua 100/50/0 é provisória ("uma nota depois a gente valida") | 51:05–51:28 | ✅ fontes (motores + domínios top 10) · 📋 validar régua |
| 4.7 | Sanidade combinada: "só de alguém aparecer 100% das vezes em primeiro lugar, tem que dar uma olhada no motor" | 51:45 | ✅ (invariante `consistency-perfect-rank`, por marca × motor, amostra ≥10) |

### Produto e operação

| # | Decisão | Evidência | Status |
|---|---|---|---|
| 4.8 | **Custos & consumo só no acesso ADM** — nunca na tela do cliente ("ali tá descrito a nossa margem"); solução stand-alone, custo de IA fica na margem | 11:09–14:57 | ✅ página admin-only existe · ⏳ criar acesso do Igor |
| 4.9 | **"O que fazer" da Legibilidade é orientado pelo que foi LIDO do site** (premissa v2, refinada por Jhonata em 19/ago): a plataforma lê o que o site TEM (JSON-LD parseado de verdade — blocos, validade, @types —, FAQ, H1, OG, robots, llms.txt), compara com as melhores práticas e INDICA o que precisa ser feito item a item ("encontramos X, falta Y"); o copy-paste é acabamento onde couber (llms.txt continua). JSON-LD primeiro ("é o principal, onde a maioria dos sites tem problema") | 20:37–24:41 · premissa v2 confirmada | ✅ 1ª fatia (8 sinais com indicação por evidência) |
| 4.10 | Checklist da auditoria técnica confirmado: schema JSON-LD, FAQ editorial, descritivo de produto, meta tags sociais, trust/reputação (+ Rendering, idioma/país do checklist do Igor) | 25:26 | ✅ 8/8 sinais — rendering e idioma/país em 10/set, título descritivo em 11/set (rubrica 52). Em 10/set foi declarado fechado com 7: o 8º item é o `<title>` da página de produto, não o schema de Product |
| 4.11 | Conteúdo: indicar **onde publicar** (canais/revistas de referência) — "só colocar no backlog esse ponto" | 26:33–27:19 | 📋 |
| 4.12 | **Onboarding com a matriz controla / ativa / conquista** | 28:56–30:22 | 📋 deixado para depois (decisão do dono, 19/ago); material já no repo (deck v19/ago em `recebidos/`, capa + slides 3-4) |
| 4.13 | Inteligência de otimização de prompts é **do cliente e segregada** — dado da marca A nunca alimenta a marca B | 17:06–19:28 | 📋 princípio de arquitetura registrado |
| 4.14 | Label "54 de 172 rastreados" confunde — clarificar o fan-out (1 prompt → micro-perguntas) na tela | 38:14–39:43 | ✅ (card Presença "X de N" + tooltip explica o fan-out) |
| 4.15 | Igor vai **rever o nome "citabilidade"** (post-it no deck: "Rever o nome citabilidade") | deck slide 5 | ⏳ Igor |
| 4.16 | **Matriz "você controla · você ativa · você conquista" aplicada às zonas do IC** — o deck carimba a tríade na capa e taguea cada dimensão no slide 3 (Legibilidade+Conteúdo = controla · Social+Reviews = ativa · Open Media+Verticais = conquista); zonas A/B/C da tela renomeadas para a tríade, com o framing do slide 2 no subtítulo ("aqui você AGE; lá você MEDE") | deck slides 1–3 · 48:54 | ✅ |

---

## Pendências em aberto entre os sócios

1. **Nome "Índice de Citabilidade"** — Igor sinalizou revisão (4.15).
2. **Régua do sentimento (100/50/0)** — validar juntos com mais censos (4.6).
3. **Material do onboarding** (matriz controla/ativa/conquista) — Igor → Jhonata → repo (4.12).
4. **9º motor** — validação técnica DeepMind/Minimax antes de virar promessa (2.10).
5. **Acesso ADM do Igor** ao painel de custos (4.8).
6. **Nota composta 0-100 na página Score** — mantida por ora (o "sem nota
   ponderada" de 4.5 vale para o resumo); confirmar se fica.

> Manutenção: cada nova sessão dos sócios adiciona uma seção aqui, no mesmo
> PR do trabalho que a implementa — mesma regra do `DECISOES.md`.
