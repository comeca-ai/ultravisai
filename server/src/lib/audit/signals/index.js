/**
 * Registry of implemented signal evaluators. Each category file exports its
 * own array; new signals are added there and surface here automatically.
 *
 * Faz 1 implements the 38 deterministic signals (Structure 18, Trust 7,
 * Authority 7, Content 3, E-E-A-T 3) of the 52-signal rubric. The remaining 14
 * need a target query, an LLM judge, or an external lookup (Wikidata / press)
 * and land in later phases.
 *
 * Structure foi de 13 pra 18 fechando o checklist do Igor (ata 4.10):
 * `sitemap-presence` e `product-schema` em 09/set (ajustar.md, Parte 4),
 * `rendering` e `language-country` em 10/set, `descriptive-title` em 11/set.
 * AGORA sim o checklist está 8/8 — em 10/set foi declarado fechado com 7,
 * porque "descritivo de produto" tinha sido lido como o schema de Product e
 * o oitavo item da planilha é outro: o TÍTULO da página de produto. The scorer reports coverage (evaluated / total) so
 * partial implementation never penalizes a page for signals we haven't built.
 */

import { structureSignals } from './structure.js';
import { authoritySignals } from './authority.js';
import { contentSignals } from './content.js';
import { trustSignals } from './trust.js';
import { eeatSignals } from './eeat.js';

export const signalRegistry = [
  ...structureSignals,
  ...authoritySignals,
  ...contentSignals,
  ...trustSignals,
  ...eeatSignals,
];
