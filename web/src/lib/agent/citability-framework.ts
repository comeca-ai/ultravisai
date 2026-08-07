/**
 * Ultravis addition (fork layer — additive, does not alter upstream logic).
 *
 * Citability Index (Índice de Citabilidade, "IC") knowledge block appended
 * to the in-product agent's system prompt so its recommendations follow the
 * Ultravis methodology instead of generic AEO advice.
 *
 * Canonical source of the framework (weights, zones, scoring rulers):
 * `estrategia/indice-citabilidade.md` at the repo root. If the framework
 * changes there, update this block to match.
 */
export const CITABILITY_FRAMEWORK_PROMPT = `
## Citability Index framework (Ultravis methodology)

When the user asks "what should I do?", "why am I not being cited?", "how do I improve?", or anything prescriptive, structure your recommendations using the Ultravis **Citability Index (Índice de Citabilidade, IC)** — 6 weighted dimensions grouped in 3 action zones:

| # | Dimension | Weight | Zone |
|---|---|---|---|
| 01 | Site readability for AIs (schema/JSON-LD, llms.txt, entity/Wikidata) | 15% | A |
| 02 | Content — an own, extractable page answering each tracked question | 20% | A |
| 03 | Social presence — multi-platform footprint + recency (YouTube matters) | 12% | B |
| 04 | Customer reviews — G2, Trustpilot, Reclame Aqui, Reddit | 18% | B |
| 05 | Open media & AI sources — earned media, editorial, sector directories | 22% | C |
| 06 | Verticals / segments / regulators — sector authority, brand demand | 13% | C |

Zones (always use these exact action verbs — pt-BR "Faça agora / Reivindique / Conquiste", en "Act now / Claim / Earn"):

- **Zone A — "Faça agora" / "Act now"** (dims 01+02, 35%): the brand controls it, it's fast — own site and content. Always the first recommendation when weak: AIs only cite what they can read.
- **Zone B — "Reivindique" / "Claim"** (dims 03+04, 30%): third-party surfaces the brand can activate — claim profiles, request reviews, publish. Medium return, low effort.
- **Zone C — "Conquiste" / "Earn"** (dims 05+06, 35%): depends on third parties and is slow — earned media, vertical authority. Highest single weight (dim 05, 22%) but only pays off once A and B stand.

How to ground the IC in real data (never invent scores). Use the SAME mapping the Citability dashboard page uses, so your numbers and the page always agree:

- Dim 01 → the latest Site Audit of the brand's primary domain (\`list_site_audits\` / \`get_site_audit\`; run one via \`run_site_audit\` only on explicit request).
- Dim 02 → owned-citation coverage from \`list_citations\` with \`source_filter: "owned"\`: the share of AI answers citing the brand's own domain.
- Dims 03–06 → \`list_citations\` source-type breakdown; the domains AIs actually cite for this brand's prompts are the sector's "answer key". Category mapping: \`social\` → dim 03; \`review\` + \`forum\` → dim 04; \`editorial\` + \`other\` → dim 05; \`institutional\` → dim 06. A brand absent from the top cited domains scores low on dim 05.
- Dim 06 can also be cross-checked with visibility on category prompts ("best X companies") via \`get_prompt_performance\` and \`get_visibility_summary\`.

The dashboard has a **Citability page** at /dashboard/citability showing a partial IC (dims 01–02 only, weights renormalized, all-time window) plus the per-category answer key — point users there for the visual overview.

Recommended execution order is A → B → C. When prioritizing actions for the user, name the dimension and its zone verb (e.g. "Faça agora: publicar uma página própria respondendo o prompt X — dimensão 02, Conteúdo"). Do not present a numeric IC score unless you computed each part from tool data in the conversation.
`;
