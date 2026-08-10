# Feedback do cliente (Polar) — revisão 07–10/ago/2026

> Estruturação do documento `Ultravis_Site_v2_2_2.docx` enviado pelo cliente
> após o teste real na base (conta `imeskelis@me.com`, marca "Polar Electro",
> 184 resultados rastreados em 10/ago). Cada item com diagnóstico honesto,
> esforço (P/M/G) e status. **Última atualização:** 10/ago/2026.

## Achados transversais (diagnóstico FINAL, corrigido em 10/ago à noite)

**A) Itens 1, 2 e 19 (descrição do site, tópicos, prompt suggestions):** a
**`OPENAI_API_KEY` estava morta durante o onboarding do cliente** (21:55 de
domingo — janela do 401). Chave corrigida às 08:36 de 10/ago; **testada
válida via banco (HTTP 200)**. Resolvido.

**B) SoV = 0, sentimento 100% neutro e visibilidade ~0 do run (item 7):**
**NÃO era a chave** — era **matching exato do nome da marca**. O cliente
cadastrou "**Polar Electro**" (razão social); as IAs escrevem "Polar". O
parser conta texto literal → **0 menções em 184 respostas** → SoV 0 →
sentimento nem roda ("Brand not mentioned"). **Fix:** aliases de marca
(migration 00036; alias "Polar" configurado) + **backfill** dos 184
resultados recomputado do texto salvo (zero crédito Cloro). Decisão: **não
renomear a marca do cliente** — o produto se adapta à marca.

## Tabela estruturada

| # | Área | Feedback | Tipo | Diagnóstico / resposta | Esforço | Status |
|---|---|---|---|---|---|---|
| 1 | Onboarding | Não leu `polar.com/br` pra recomendar descrição | 🐞 Bug | **Causa raiz: chave OpenAI inválida** (sugestões usam gpt-5-mini) | — | Aguarda chave válida |
| 2 | Onboarding | Não recomendou tópicos ("bug temporário?") | 🐞 Bug | Mesma causa do #1. Sim, temporário — provider, não a tool | — | Aguarda chave válida |
| 3 | Visibilidade | Título → "Resumo de Visibilidade nas IAs" | ✏️ Copy | Troca simples de string (i18n) | P | A fazer |
| 4 | Visibilidade | Aba clara de "o que fazer e como" nas dimensões técnicas | 🚀 Feature | É a **Citabilidade v2** (plano de ação sequenciado) — já era o herói do backlog | M | Já no BACKLOG (P1) |
| 5 | Visibilidade | "Índice de Visibilidade" em vez de "taxa de visibilidade" | ✏️ Copy | Troca de nomenclatura (i18n). Atenção pra não colidir com "Índice de Citabilidade" | P | A fazer |
| 6 | Visibilidade | Botão "Rodar Tudo" maior e à esquerda (demorou a achar) | 🎨 UX | Reposicionar/destacar o CTA | P | A fazer |
| 7 | Visibilidade | Share of Voice zero apesar de ter respostas — explicar | 🎨 UX | SoV conta **menções da marca**, não respostas; zero real precisa de explicação na tela (tooltip/empty-state) | P | A fazer |
| 8 | Citabilidade | Por que não calcula tudo de uma vez? | 💬 Explicar + 🚀 | Desenho intencional (só mostramos o que medimos). Medir as 6 = enriquecer D3–D6 (Ahrefs etc.) — já no backlog | M/G | Parcial no BACKLOG (P1) |
| 9 | Citabilidade | Faixas de nota: 0-30 Indesejável · 31-50 Regular · 51-70 Boa · 71-90 Ótima · 91-100 Best in class | 🚀 Feature | Ótima ideia, barata — rótulo de faixa junto da nota | P | A fazer (incorporar ao IC) |
| 10 | Citabilidade | Gráfico de evolução da nota (total + por dimensão) a cada rodada | 🚀 Feature | Requer **snapshot histórico do IC** (tabela nova, aditiva) + gráfico | M | A fazer |
| 11 | Citabilidade | O que significa "35% do índice medido"? | 🎨 UX | O conceito de cobertura confundiu — reescrever o rótulo/explicação | P | A fazer |
| 12 | Citabilidade | Regra de cálculo para revisar/ajustar | 📄 Docs | Já existe versionada: `estrategia/indice-citabilidade.md` — compartilhar com o cliente | P | Pronto (enviar) |
| 13 | Citabilidade | Legibilidade 46 significa o quê? Por que não 25 ou 90? | 🎨 UX | Expor o **breakdown da auditoria** (critérios que compõem o score) na Citabilidade ou link pro detalhe | M | A fazer |
| 14 | Citabilidade | Gráfico perdeu formato da escala | 🐞 Bug visual | Investigar qual gráfico (print ajudaria) | P? | Investigar |
| 15 | Citabilidade | **Recomendações com código pronto** (llms.txt, schema, FAQ, metatags) pra copy+paste | 🚀 Feature ⭐ | Alto valor e viável — gerar snippets prontos por marca. Encaixa na Citabilidade v2 | M | A fazer (priorizar) |
| 16 | Prompts | Por que alguns não rodaram? | 💬 Explicar | Falhas de superfície (Grok caiu no Cloro em 10/ago; AIO sem overview em algumas queries) — normal, mas precisa ficar visível por prompt | P/M | Explicado; UX a fazer |
| 17 | Prompts | Coluna "Work" — o que significa? | ✏️ i18n | Coluna do workflow de prompts sem tradução/clareza | P | A fazer |
| 18 | Prompts | "Visibility" é ranking ou o quê? Melhorar títulos de colunas | 🎨 UX | Tooltips/títulos autoexplicativos nas colunas de resultado | P | A fazer |
| 19 | Prompts | Prompt suggestions: como funcionar (manual e automático)? | 🐞+💬 | Depende da **chave OpenAI** (causa raiz #1) + explicar o fluxo | — | Aguarda chave |
| 20 | Tópicos | Como interpretar e o que aprendemos aqui? | 🎨 UX | Falta camada educacional ("o que fazer com isso") na página | M | A fazer |
| 21 | Shopping | Aprimorar os anteriores antes | ⏸️ | Cliente pausou — ok | — | Pausado |
| 22 | Admin | Versão ADMIN: ver todos os relatórios e marcas rodadas | 🚀 Feature | Parcial já existe (/ops + Custos operador-only). Falta visão consolidada de marcas/relatórios no app | M | Parcial; ampliar |
| 23 | Admin | ultravis.ai logado → ir pra home, não pra ferramenta | 🔧 Config/UX | Comportamento herdado (logado → dashboard). Mudável — decisão de produto | P | Decidir + fazer |
| 24 | Planos (old) | Cadência 3×/semana como diferencial de plano; mínimo semanal no básico | 💡 Produto | Vira atributo de pricing — casa com "alinhar planos + Stripe" do backlog | M | Já relacionado no BACKLOG |
| 25 | Onboarding (old) | "Ler o site pro briefing era muito melhor que digitar" | ✅ Elogio | A feature existe (fomos nós que construímos) — estava quebrada pela chave. Volta com o fix | — | Aguarda chave |
| 26 | Branding (old) | Visuais/teaser — cliente manda proposta em paralelo | ⏸️ | Aguardar material do cliente | — | Com o cliente |
| 27 | Login (old) | Conta já existe → não indica, só mostra erro | 🐞 Bug | Conhecido (lista do docx anterior) — melhorar a mensagem no sign-up | P | A fazer |
| 28 | Branding (old) | "Rodando como Ansvisor (perdemos o segredo)" | 🐞 Branding | Suspeita: **templates de e-mail do Supabase** ainda com marca padrão — trocar textos/remetente | P | A fazer |
| 29 | Login (old) | Tela de login trava, não avança nem volta | 🐞 Bug | Conhecido; parcialmente endereçado (logout→landing). **Reverificar** pós-mudanças | ? | Verificar |
| 30 | Relatórios (old) | Relatório não saiu | 🐞 Bug | Conhecido — validar a feature de Relatórios (pré-requisito do "Resumo Executivo" do backlog) | M | Investigar |

## Leitura executiva

- **1 causa raiz explica 4 itens** (chave OpenAI) — resolver primeiro.
- **Rápidos e de alto impacto percebido (fazer já):** #3, #5, #6, #7, #9, #11, #17, #18, #27 — quase tudo copy/UX de P.
- **O pedido mais valioso:** #15 (snippets prontos de llms.txt/schema/FAQ/metatags) — vira o coração da **Citabilidade v2**.
- **Estrutural novo:** #10 (histórico do IC — precisa de snapshot em banco).
- **O cliente é engajado**: leu, testou tudo, pediu a regra de cálculo e ofereceu ajuda no branding. Sinal de compra.
