/**
 * Registry of implemented signal evaluators. Each category file exports its
 * own array; new signals are added there and surface here automatically.
 *
 * Faz 1 implements the 37 deterministic signals (Structure 17, Trust 7,
 * Authority 7, Content 3, E-E-A-T 3) of the 51-signal rubric. The remaining 14
 * need a target query, an LLM judge, or an external lookup (Wikidata / press)
 * and land in later phases.
 *
 * Structure foi de 13 pra 17 fechando o checklist do Igor (ata 4.10):
 * `sitemap-presence` e `product-schema` em 09/set (ajustar.md, Parte 4),
 * `rendering` e `language-country` em 10/set. Com isso o checklist sai de
 * 6/8 para 8/8 — nenhum item do slide fica sem sinal. The scorer reports coverage (evaluated / total) so
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
