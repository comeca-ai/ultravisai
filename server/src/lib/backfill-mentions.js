/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Mention/sentiment backfill for already-collected results. Mention counting
 * happens at ingest, so a brand whose registered name never appears verbatim
 * in AI answers (e.g. "Polar Electro" vs answers saying "Polar") ends up with
 * 0 mentions / 0 SoV / all-neutral sentiment — even though the answer TEXT is
 * stored. After adding aliases (migration 00036), this recomputes the stored
 * rows from that text using the SAME parser as ingest — no Cloro credits.
 *
 * Trigger: set BACKFILL_MENTIONS_BRAND_ID=<brand uuid> in the environment and
 * (re)deploy — the boot hook runs the backfill once, logs progress, and tells
 * you to unset the variable. Idempotent: recomputing twice yields the same
 * rows, so a crash/restart mid-run is harmless.
 */

import { logger } from './logger.js';
import { parseResponse, countBrandMentions } from './response-parser.js';
import { analyzeSentimentAI } from './ai-tracker.js';

const PAGE = 100;

/** Recompute mentions/sentiment/visibility for every stored result of a brand. */
export async function backfillBrandMentions(brandId) {
  const { default: supabaseAdmin } = await import('../config/supabase.js');

  const [{ data: brand }, { data: domains }, { data: competitorRows }] = await Promise.all([
    supabaseAdmin.from('brands').select('id, name, aliases').eq('id', brandId).single(),
    supabaseAdmin.from('brand_domains').select('domain').eq('brand_id', brandId),
    supabaseAdmin.from('competitors').select('id, name, domain').eq('brand_id', brandId),
  ]);
  if (!brand) throw new Error(`backfill-mentions: brand not found: ${brandId}`);

  const brandInfo = {
    brandName: brand.name,
    domains: (domains || []).map((d) => d.domain),
    aliases: brand.aliases || [],
  };
  const competitors = (competitorRows || []).map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain || '',
  }));

  logger.info(
    { brandId, brand: brand.name, aliases: brandInfo.aliases },
    '[backfill-mentions] starting',
  );

  let offset = 0;
  let updated = 0;
  let nowMentioned = 0;

  for (;;) {
    const { data: rows, error } = await supabaseAdmin
      .from('prompt_results')
      .select('id, response, citations, mention_count')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const text = row.response || '';
      const citations = Array.isArray(row.citations) ? row.citations : [];

      // Same order as ingest: count mentions → sentiment (AI only when
      // mentioned) → full parse with that sentiment.
      const mentionCount = countBrandMentions(text, brandInfo);
      const sentimentResult =
        mentionCount > 0
          ? await analyzeSentimentAI(text, brandInfo.brandName)
          : { sentiment: 'neutral', confidence: 0, reason: 'Brand not mentioned' };

      const metrics = parseResponse(
        { text, citations },
        brandInfo,
        sentimentResult.sentiment,
        competitors,
      );

      const { error: upErr } = await supabaseAdmin
        .from('prompt_results')
        .update({
          mention_count: metrics.mentionCount,
          citation_count: metrics.citationCount,
          sentiment: metrics.sentiment,
          visibility_score: metrics.visibilityScore,
          competitor_mentions: metrics.competitorMentions,
        })
        .eq('id', row.id);
      if (upErr) {
        logger.error({ err: upErr, rowId: row.id }, '[backfill-mentions] update failed');
        continue;
      }
      updated += 1;
      if (metrics.mentionCount > 0) nowMentioned += 1;
      if (updated % 25 === 0) {
        logger.info({ updated, nowMentioned }, '[backfill-mentions] progress');
      }
    }

    offset += rows.length;
  }

  logger.info(
    { brandId, updated, nowMentioned },
    '[backfill-mentions] DONE — unset BACKFILL_MENTIONS_BRAND_ID to stop re-running on boot',
  );
  return { updated, nowMentioned };
}

/** Boot hook: run the backfill when the env var asks for it (non-blocking). */
export function runPendingMentionBackfillFromEnv() {
  const brandId = process.env.BACKFILL_MENTIONS_BRAND_ID;
  if (!brandId) return;
  logger.info({ brandId }, '[backfill-mentions] env trigger detected — running after boot');
  setTimeout(() => {
    backfillBrandMentions(brandId).catch((err) =>
      logger.error({ err }, '[backfill-mentions] run failed'),
    );
  }, 5_000);
}
