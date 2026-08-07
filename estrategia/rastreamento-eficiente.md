# Estratégia de Rastreamento Eficiente — valor máximo pro cliente, custo mínimo de servir

> **Status:** proposta (nada implementado — tudo aqui é operável com a
> configuração existente, salvo a seção 7, que é backlog de produto).
> **Contexto:** o custo do Ultravis é dominado por scrapes Cloro
> (`prompts × plataformas × regiões × frequência`). O primeiro run real
> (Datarisk) rodou no modo máximo — 280 tarefas — e expôs o problema:
> o default "tudo em todas" é ótimo pra demo e insustentável como rotina.
>
> Data: 07/ago/2026

---

## 1. O princípio: censo raramente, pulso sempre

A pergunta que o cliente paga pra responder não é "o que toda IA diz sobre mim
o tempo todo?" — é **"estou ganhando ou perdendo a resposta, e o que mudou?"**.

Duas medições diferentes respondem isso:

| | **Censo** | **Pulso** |
|---|---|---|
| O que é | Retrato completo: todos os prompts × todas as 7 plataformas | Monitor contínuo: prompts prioritários × plataformas essenciais |
| Frequência | 1x/mês (ou no kickoff e depois trimestral, no plano de entrada) | Semanal |
| Pergunta que responde | "Qual meu mapa completo de visibilidade? Onde apareço, onde sumo, quem me substitui em cada motor?" | "Mudou algo que importa? Subi, caí, concorrente entrou?" |
| Entregável | Relatório executivo mensal (comparativo por plataforma, evolução do share of answer) | Alerta/resumo semanal de variações |
| Custo (exemplo Datarisk) | 280 scrapes, 1x/mês | ~45–135 scrapes/semana |

O censo dá a narrativa e a profundidade; o pulso dá a sensação de vigilância
contínua. O cliente percebe **mais** valor do que no modelo "tudo toda semana"
— porque variação semanal em 7 plataformas × 40 prompts é ruído que ninguém lê,
enquanto "3 mudanças relevantes essa semana" é informação.

## 2. Camadas de prompts (nem todo prompt vale o mesmo)

- **P0 — money prompts (10–15):** alta intenção comercial ("melhor ferramenta
  de X", "X vale a pena", "alternativas a Y"). São os prompts onde perder a
  resposta custa cliente. → entram no **pulso semanal**.
- **P1 — cauda de cobertura (o resto):** informacionais, tendências, casos de
  uso. Constroem o mapa, mas mudam devagar. → só no **censo mensal**.

Como classificar: intenção (comparação/recomendação > informacional), volume
estimado (página Prompts mostra), e proximidade da decisão de compra.

## 3. Camadas de plataformas (mercado BR)

| Tier | Plataformas | Racional | Onde entra |
|---|---|---|---|
| **T1 — essenciais** | ChatGPT web · Google AI Overviews · Perplexity | Maior audiência BR + AIO intercepta a busca Google tradicional | Pulso + censo |
| **T2 — contexto** | Gemini web · Google AI Mode | Relevância crescente (ecossistema Google), mas sinal correlacionado com AIO | Censo |
| **T3 — periferia** | Copilot · Grok | Audiência BR pequena hoje; sinal de completude | Censo |

Revisar os tiers por cliente: um cliente B2B Microsoft-heavy pode promover o
Copilot pra T1; um cliente de consumo jovem, o Grok.

## 4. A matemática (Datarisk como exemplo real)

Config observada no 1º run: 40 prompts × 7 plataformas.

| Modelo | Conta | Scrapes/mês |
|---|---|---|
| **Atual (default do onboarding)** | 280 × 4 semanas | **1.120** |
| **Estratégia proposta** | Censo: 280 × 1 + Pulso: 15 prompts × 3 plataformas × 4 semanas (180) | **460** |
| Economia | | **–59%** com percepção de valor igual ou maior |

Plano de entrada mais enxuto (POC/piloto): censo só no kickoff + pulso semanal
= **180/mês** após o primeiro mês.

## 5. O que o cliente recebe em cada cadência (a parte "eficiente pro cliente")

- **Semana a semana (pulso):** 3–5 variações que importam, em linguagem de
  ação — "você perdeu a citação em 'melhores plataformas de ML' no ChatGPT;
  a resposta agora cita o concorrente X; brief de conteúdo sugerido: [link]".
- **Mês a mês (censo):** o relatório executivo — share of answer por
  plataforma, evolução vs mês anterior, ranking de concorrentes, top 3
  oportunidades de conteúdo. É o artefato que o decisor encaminha internamente.
- **Regra de comunicação:** nunca entregar dado cru como valor; o scrape é
  matéria-prima, o entregável é a variação + a ação.

## 6. Como operar isso HOJE (zero código)

1. **Após o primeiro censo do cliente** (o run de kickoff, tipo o da Datarisk):
   na página **Prompts**, editar os prompts P1 e desmarcar as plataformas T2/T3
   — deixando só T1 nos P0 e, opcionalmente, pausando (is_active) a cauda
   entre censos.
2. **Cron semanal** já é o default (`DAILY_CRON_SCHEDULE=0 6 * * 1`).
3. **Censo mensal:** na semana do censo, reativar plataformas/prompts e usar
   "Rodar agora" (ou simplesmente deixar o cron daquela semana rodar a config
   cheia e enxugar de novo depois).
4. **Novos clientes:** no passo de prompts do onboarding, orientar (ou operar
   com o cliente) a seleção de 2–4 tópicos e o trio T1 — o default "tudo em
   todas" fica reservado pro run de kickoff.

Custo operacional desse processo: ~10 min/mês por cliente, manual. Aceitável
até ~5 clientes; depois, seção 7.

## 7. Backlog de produto (exigiria código — NÃO implementar agora)

Em ordem de valor quando a operação manual apertar:

1. **Cadência por prompt** (`weekly | monthly` no prompt): o worker filtra por
   cadência no run — elimina o liga/desliga manual do censo. Mudança pequena
   (1 coluna + 1 filtro no tracking-worker).
2. **Perfis de rastreamento** ("Kickoff completo" / "Pulso enxuto" / "Censo")
   aplicáveis com 1 clique na marca.
3. **Alertas de variação** (item já no roadmap upstream): e-mail/Slack quando
   score cai ou concorrente entra — transforma o pulso em produto percebido
   sem o cliente abrir o dashboard.
4. **Rotação amostral da cauda:** em vez de censo integral mensal, rastrear
   1/4 da cauda por semana (mesmo custo, dado mais fresco).

## 8. Riscos e contrapontos

- **"Menos plataformas = cliente acha que o produto encolheu"** → framing:
  vender censo+pulso como metodologia ("cobertura total mensal + vigilância
  semanal do que importa"), não como corte.
- **Variação semanal em amostra pequena é ruidosa** → o pulso compara média
  móvel, não pontos isolados; o censo ancora a tendência.
- **Tier de plataformas é hipótese** → o próprio censo mensal valida: se o
  Copilot começar a citar o cliente com frequência, promove pra T1 (dado
  decide, não opinião).
