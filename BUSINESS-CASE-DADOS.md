# Ultravis — Dados para o Business Case

> Log de dados reais coletados durante a construção e operação da plataforma.
> Atualizado conforme os fatos acontecem. Base para o business case (pricing,
> custo de servir, margem, posicionamento).
>
> **Última atualização:** 07/ago/2026

---

## 1. Custos de infraestrutura (fixos mensais)

| Item | Serviço | Custo estimado |
|---|---|---|
| Frontend + landing | Vercel (projeto `utravisaiclaude`) | US$ 0 (Hobby) — US$ 20/mês se migrar pro Pro |
| Backend + cron | Railway (`ultravis-server`, 1 replica) | ~US$ 5–15/mês conforme uso |
| Banco + Auth | Supabase (`twhqjfbealruvcbvkegc`) | US$ 0 (Free) — atenção: free pausa após ~1 semana inativo; Pro = US$ 25/mês |
| Domínio | ultravis.ai (Cloudflare DNS) | ~US$ 70–90/ano (renovação .ai) |
| **Total base** | | **~US$ 5–15/mês** hoje; ~US$ 60/mês em stack toda paga |

## 2. Custos variáveis por unidade (motor)

| Unidade | Provider | Custo | Observação |
|---|---|---|---|
| 1 scrape (prompt × plataforma × região) | Cloro | 1 crédito (ver valor do crédito no plano contratado) | **Principal driver de custo** |
| 1 análise de sentimento | OpenAI `gpt-5-mini` | ~US$ 0,0002–0,001 | Só roda quando a marca é mencionada |
| 1 rodada de sugestões (tópicos OU prompts OU concorrentes) | Gemini Flash | centavos de US$ | Só no onboarding / sob demanda |
| 1 resumo de site (botão ✨) | Gemini Flash | centavos de US$ | 1 clique |
| 1 pergunta ao AI Agent | Claude Sonnet 5 | ~US$ 0,05–0,15 | Interativo, baixo volume |
| Rastreio API `claude-sonnet-5` | Anthropic | ~US$ 0,01–0,05/prompt | Só em prompts que marcarem o modelo |

**Regra de bolso:** todo o custo de LLM de um onboarding completo < 1 scrape Cloro.

## 3. Matemática do custo de servir (fórmula)

```
scrapes por run  = prompts ativos × plataformas × regiões
scrapes por mês  = scrapes por run × frequência (semanal ×4 | diária ×30)
```

| Cenário | Config | Scrapes/mês |
|---|---|---|
| POC enxuta | 15 prompts × 3 plataformas × 1 região, semanal | **180** |
| Cliente médio | 40 prompts × 5 plataformas × 1 região, semanal | 800 |
| Cliente intenso | 50 prompts × 7 plataformas × 1 região, diário | 10.500 |

## 4. Dados reais coletados

### 4.0 Snapshot de consumo — 07/ago 22h UTC (1º dia de operação)
- **63 respostas rastreadas**: 28 scrapes Cloro (Datarisk 27 + E2E 1) +
  35 via API Claude (marca Accenture, rastreio 100% `claude`)
- **63 análises de sentimento** (gpt-5-mini, ~4,6k chars médios de entrada)
- **LLM estimado do dia: ≈ US$ 0,70** (Anthropic ~US$ 0,65 — 136k chars de
  saída no rastreio Accenture; OpenAI ~US$ 0,04; Gemini US$ 0,00 free tier)
- **Cloro: 28 créditos** (valor do crédito ainda pendente — checklist §6)
- Gemini free tier = 20 req/dia no `gemini-3-flash` → cota estourada às ~22h
  (falha em "gerar prompts"); sugestões/audit trocados para Anthropic Haiku
- 0 site audits · 0 tokens de agent registrados
- **Página de monitoramento no produto**: `/dashboard/admin/costs` (menu
  Admin → Custos & Consumo) — contagens ao vivo do banco + estimativas US$

### 4.1 Teste E2E (marca de teste, 07/ago 15:22 UTC)
- 1 prompt × 1 plataforma (`chatgpt-web`, região BR)
- **Duração ponta-a-ponta: ~40 segundos** (cron → Cloro → parse → banco)
- Resposta capturada: 5.999 caracteres, **16 URLs citadas**
- Menções à marca: 0 (marca nova — o retrato honesto que o produto vende)

### 4.2 Primeiro cliente real: Datarisk (onboarding 07/ago ~15:22–16:20 UTC)
- Cadastro → confirmação de e-mail → onboarding completo (com os percalços de
  provider corrigidos ao vivo; fluxo agora estável)
- Descrição preenchida manualmente; tópicos via IA (Gemini Flash com busca web)
- **Primeiro run disparado: 280 tarefas** (≈ 40 prompts × 7 plataformas)
  - ⚠️ 280 scrapes por run → no cron semanal = ~1.120 scrapes/mês para 1 marca
  - Lição de eficiência: seletor de plataformas por prompt merece curadoria
    (3 plataformas cobririam o essencial por ~43% do custo)
- [PENDENTE] preencher ao fim do run: nº de resultados, menções, citações,
  share of answer, sentimento, duração total

### 4.3 Funil de onboarding (tempos observados)
- Cadastro + confirmação de e-mail: ~2 min
- Onboarding completo (marca → tópicos → prompts → concorrentes): ~10–15 min
  (com falhas de provider; esperado ~5 min com fluxo estável)
- Tempo até o primeiro dado no dashboard: duração do primeiro run

## 5. Referências de preço

| Fonte | Starter | Growth | Enterprise |
|---|---|---|---|
| **Código upstream** (`plans.ts`, US$) | US$ 49/mês (1 marca, 50 prompts, 2 plataformas) | US$ 249/mês (4 marcas, 200 prompts, 8 plataformas) | sob consulta |
| **Landing Ultravis** (proposta, R$) | R$ 390/mês (150 prompts, 4 motores) | R$ 1.290/mês (1.000 prompts, 7 motores) | sob consulta |

⚠️ Divergência conhecida: números da landing ≠ limites do código. Alinhar antes
de monetizar (mudança trivial em `plans.js`/`plans.ts` + landing).

## 6. A coletar (checklist)

- [ ] Resultado completo do primeiro run da Datarisk (menções, citações, score)
- [ ] Valor do crédito Cloro no plano contratado → custo real por scrape em R$
- [ ] Consumo real por provider após 1 semana (painéis OpenAI/Anthropic/Google)
- [ ] Custo Railway real do primeiro mês (painel usage)
- [ ] Preços de concorrentes internacionais (Profound, Peec AI, Otterly,
      Scrunch) e do Ansvisor cloud — pra ancorar o pricing BR
- [ ] Tempo de retenção/uso da Datarisk (volta ao dashboard? usa o Agent?)
- [ ] 2º e 3º cliente piloto: repetir medições do funil

## 7. Linha do tempo da construção (custo de montar a plataforma)

| Data | Marco |
|---|---|
| 31/jul–03/ago | Fork, experimentos de deploy, rebrand inicial |
| 07/ago (1 sessão) | Arquitetura POC documentada, logo 1c, landing PT/EN no ar em ultravis.ai, onboarding traduzido, bug do banco corrigido, infra consolidada (1 Vercel + 1 Railway + 1 Supabase), chaves rotacionadas, E2E validado, 4 providers ativos, botão "descrição via IA", 1º cliente real onboardado |

---

*Arquivo mantido pelo fluxo de trabalho com Claude Code — adicionar dados novos
no topo de cada seção com data.*
