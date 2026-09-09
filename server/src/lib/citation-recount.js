/**
 * Recompute `prompt_results.citation_count` for a brand from the stored
 * citations JSONB and the brand's CURRENT domain list.
 *
 * citation_count is computed at tracking time and frozen into the row, so a
 * later change to `brand_domains` silently desyncs it from what the
 * Citations page computes live — the same "own citations" metric then shows
 * different numbers on different surfaces. The web layer calls this through
 * `/api/internal/recount-citations` whenever a brand's domain list changes.
 *
 * Desde 09/set a conta é a do dono (ajustar.md Parte 3): domínio próprio MAIS
 * link de terceiro que traga claramente o produto. Então mudar `aliases` ou
 * `citation_terms` também desincroniza o número — não só o domínio.
 *
 * `visibility_score` is intentionally NOT recomputed: it is a point-in-time
 * heuristic, and rewriting it would retroactively reshape historical trend
 * charts. Only the citation tally is brought in line.
 */

import supabaseAdmin from '../config/supabase.js';
import { contarCitacoesDoProduto } from './response-parser.js';
import logger from './logger.js';

const RECOUNT_PAGE_SIZE = 1000;
const RECOUNT_MAX_ROWS = 200_000;

export async function recountBrandCitations(brandId) {
  const [{ data: domainRows, error: domainErr }, { data: brand, error: brandErr }] =
    await Promise.all([
      supabaseAdmin.from('brand_domains').select('domain').eq('brand_id', brandId),
      supabaseAdmin
        .from('brands')
        .select('name, aliases, citation_terms')
        .eq('id', brandId)
        .single(),
    ]);
  if (domainErr) throw new Error(domainErr.message);
  if (brandErr) throw new Error(brandErr.message);
  const domains = (domainRows || []).map((r) => r.domain);
  // Mesma escolha de termos do parser: `citation_terms` quando a marca
  // cadastrou, nome + aliases caso contrário. Se as duas pontas divergirem
  // aqui, o recount passa a "consertar" o número pra um valor que o
  // rastreamento nunca produziria.
  const termos =
    brand?.citation_terms?.length > 0
      ? brand.citation_terms
      : [brand?.name, ...(brand?.aliases || [])].filter(Boolean);

  let scanned = 0;
  let updated = 0;

  for (let offset = 0; offset < RECOUNT_MAX_ROWS; offset += RECOUNT_PAGE_SIZE) {
    const { data: rows, error } = await supabaseAdmin
      .from('prompt_results')
      .select('id, citations, citation_count')
      .eq('brand_id', brandId)
      // Deterministic order so .range() pages don't shuffle between requests
      // (citation_count updates don't touch the ordering columns).
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + RECOUNT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = rows || [];
    scanned += batch.length;

    for (const row of batch) {
      const citations = Array.isArray(row.citations) ? row.citations : [];
      const fresh = contarCitacoesDoProduto(citations, { domains, termos }).total;
      if (fresh !== row.citation_count) {
        const { error: updateErr } = await supabaseAdmin
          .from('prompt_results')
          .update({ citation_count: fresh })
          .eq('id', row.id);
        if (updateErr) throw new Error(updateErr.message);
        updated++;
      }
    }

    if (batch.length < RECOUNT_PAGE_SIZE) break;
  }

  logger.info({ brandId, scanned, updated }, '[citations] recount complete');
  return { scanned, updated };
}
