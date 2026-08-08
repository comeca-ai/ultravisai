# Fontes externas de dados + grounding de prompts

> Ideia do fundador (ago/2026): marcas de consumo lançam produtos o tempo
> todo para públicos distintos — trazer **outras fontes de dados** para
> complementar a análise da LLM. Este doc registra a visão, o teste do
> AlsoAsked × Semrush/Ahrefs, e o que construir.
>
> Conecta com: `benchmarking-competitivo.md` (§6 lacunas: atribuição +
> índice acionável) e `indice-citabilidade.md` (D3–D6 precisam de dado
> externo). Referência: `referencias/curso-geo-joio-do-trigo.html` (aula 5,
> caso AlsoAsked do autor).

---

## 1. A visão — complementar, não substituir

Hoje a análise tem **uma fonte**: o scrape da LLM (Cloro) → *"onde a marca
aparece"*. Fontes externas respondem *"por quê"* e *"para quem"* — e resolvem
duas lacunas de uma vez:

1. **Preenchem a Citabilidade de verdade** (D3–D6 hoje ficam "não medido").
2. **Atacam a atribuição** — a maior lacuna do mercado (ninguém liga citação
   de IA a tráfego/lead/receita).

Regra de disciplina: **cada fonte externa só entra se fecha uma dimensão do
IC ou o loop de atribuição.** Senão é ruído (vira "dashboard de tudo").

## 2. Mapa de fontes → o que complementam

| Fonte (status) | Complementa | Vira o quê |
|---|---|---|
| **Semrush** (✅ conectado) | grounding de prompt · D2 · personas | perguntas reais com volume+intenção; lacuna de conteúdo |
| **Ahrefs** (✅ conectado) | D1/D5 (autoridade, backlinks) · D3 (social) | "não é citado porque tem 12 backlinks; concorrente tem 400" |
| **GSC / GA4** (roadmap upstream) | atribuição | citação → visita → lead (o loop que nem o Profound fecha) |
| **Reviews** (G2/Reclame Aqui — scrape/API) | D4 | gabarito de reviews com presença real |
| **AlsoAsked** (avaliado — ver §4) | grounding de prompt | árvore de PAA (People Also Ask) do Google |

## 3. Teste real — Semrush `phrase_questions` (BR)

Rodado em 08/ago para `"análise de crédito"` (categoria Datarisk), database
`br`, colunas keyword+volume+intent+dificuldade. **Retornou perguntas reais
em português, com volume de busca e código de intenção**, ex.:

```
o que é análise de crédito;140;informacional
quanto tempo demora a análise de crédito do mercado pago;110;informacional
como fazer análise de crédito;90;informacional
como fazer análise de crédito pessoa jurídica;30
como é feita a análise de risco de crédito;20
```

**Conclusão:** o Semrush entrega o núcleo do que precisamos para grounding —
perguntas que gente faz de verdade, com **volume** (prioriza demanda) e
**intenção** (separa comprador de curioso) — em **pt-BR**. Ahrefs tem
equivalente (Keywords Explorer → questions/matching terms).

## 4. Decisão sobre o AlsoAsked

**Não assinar agora.** Semrush/Ahrefs (já pagos) cobrem o essencial:
perguntas reais + volume + intenção em BR. O diferencial único do AlsoAsked é
a **árvore de PAA** (perguntas aninhadas em ramos de intenção) — *nice to
have*, não essencial. Reavaliar só se a clusterização por intenção do
Semrush/Ahrefs se mostrar rasa na prática.

## 5. O que construir (prioridade)

Convergência das ideias: **ancorar o produto em perguntas reais, agrupar por
intenção/persona, enriquecer com autoridade.**

1. **Grounding de prompts em perguntas reais** — no onboarding e no "adicionar
   marca", complementar a sugestão via LLM com `phrase_questions` (Semrush) da
   categoria. Prompts deixam de ser "inventados" e passam a ter volume real.
   *Aditivo, pequeno — melhora a qualidade do produto na origem.*
2. **Priorização por intenção = "money prompts" data-driven** — usar a coluna
   de intenção + volume para auto-etiquetar e priorizar os prompts que
   compram (operacionaliza a estratégia censo/pulso §2 **e** a ideia de
   personas de marca de consumo: uma categoria, várias intenções).
3. **Enriquecer D1/D5 com Ahrefs** (Domain Rating, backlinks, domínios que
   citam) — destrava as dimensões "não medido" da Citabilidade com dado real.
4. **Atribuição (aposta de maior teto)** — evoluir a página de Tráfego de IA
   para ligar citação → visita → lead (GSC/GA4). Maior lacuna do mercado.

Custo: cada consulta Semrush/Ahrefs gasta quota da assinatura — entra no
modelo de custo (como Cloro). Começar pelo #1 (barato, alto valor).
