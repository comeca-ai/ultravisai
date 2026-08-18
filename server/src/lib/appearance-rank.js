/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Posição por ORDEM DE APARIÇÃO (premissa do dono, 18/ago): a dimensão
 * Posição do Score de Visibilidade captura quem é mencionado primeiro,
 * segundo, terceiro no TEXTO da resposta — não quem tem mais menções.
 *
 * O texto integral de cada resposta está salvo em prompt_results.response,
 * então o rank é calculado retroativamente (histórico incluído) por este
 * enriquecimento: para cada resposta em que a marca aparece, achamos o
 * índice da PRIMEIRA menção da marca e de cada concorrente e gravamos
 * appearance_rank = 1 + (concorrentes que aparecem antes) e
 * appearance_rivals = nº de concorrentes presentes na resposta.
 *
 * Regras de matching ESPELHADAS de response-parser.js (stripUrls + \b termo
 * \b, case-insensitive) — mudanças lá devem refletir aqui, senão "menciona"
 * e "aparece em tal posição" divergem.
 *
 * Sem custo externo (só SQL + regex): roda a cada 30 min sobre as linhas
 * ainda sem rank e no boot.
 */

import cron from 'node-cron';
import logger from './logger.js';

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_SWEEP = 50;

/** Espelho de response-parser.js#stripUrls. */
function stripUrls(text) {
  let cleaned = String(text || '').replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/https?:\/\/[^\s)>\]]+/g, '');
  return cleaned;
}

/** Índice da primeira ocorrência (palavra inteira, case-insensitive) de qualquer termo; -1 se nenhum. Pura. */
export function firstIndexOf(text, terms) {
  let best = -1;
  for (const term of terms || []) {
    if (!term) continue;
    const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`\\b${escaped}\\b`, 'i').exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * Rank de aparição da marca numa resposta: 1 + concorrentes citados ANTES
 * dela no texto. rivals = concorrentes presentes em qualquer posição.
 * Devolve null quando a marca não aparece no texto. Pura.
 *
 * @param {string} responseText
 * @param {string[]} brandTerms   nome + aliases + domínios da marca
 * @param {string[][]} competitorTermsList  um array de termos por concorrente
 */
export function appearanceRankFor(responseText, brandTerms, competitorTermsList) {
  const text = stripUrls(responseText);
  const brandIdx = firstIndexOf(text, brandTerms);
  if (brandIdx === -1) return null;
  let ahead = 0;
  let rivals = 0;
  for (const terms of competitorTermsList || []) {
    const idx = firstIndexOf(text, terms);
    if (idx === -1) continue;
    rivals += 1;
    if (idx < brandIdx) ahead += 1;
  }
  return { rank: ahead + 1, rivals };
}

/** Termos de matching de uma marca/concorrente (mesma base do parser). */
function termsOfBrand(brand, domains) {
  return [brand.name, ...(brand.aliases || []), ...(domains || [])].filter(Boolean);
}

/**
 * Enriquecimento: processa linhas com menção à marca e sem rank calculado.
 * Devolve quantas linhas foram atualizadas.
 */
export async function runAppearanceRankSweep() {
  const { default: supabaseAdmin } = await import('../config/supabase.js');

  // Cache por marca: termos da marca + lista de termos dos concorrentes.
  const brandCache = new Map();
  const loadBrand = async (brandId) => {
    if (brandCache.has(brandId)) return brandCache.get(brandId);
    const [{ data: brand }, { data: domains }, { data: competitors }] = await Promise.all([
      supabaseAdmin.from('brands').select('name, aliases').eq('id', brandId).single(),
      supabaseAdmin.from('brand_domains').select('domain').eq('brand_id', brandId),
      supabaseAdmin.from('competitors').select('name, domain').eq('brand_id', brandId),
    ]);
    const entry = brand
      ? {
          brandTerms: termsOfBrand(
            brand,
            (domains || []).map((d) => d.domain),
          ),
          competitorTermsList: (competitors || []).map((c) => [c.name, c.domain].filter(Boolean)),
        }
      : null;
    brandCache.set(brandId, entry);
    return entry;
  };

  let updated = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_SWEEP; batch += 1) {
    const { data: rows, error } = await supabaseAdmin
      .from('prompt_results')
      .select('id, brand_id, response')
      .is('appearance_rank', null)
      .gt('mention_count', 0)
      .order('created_at', { ascending: false })
      .limit(BATCH_SIZE);
    if (error) {
      logger.error({ err: error }, 'appearance-rank: fetch failed');
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const ctx = await loadBrand(row.brand_id);
      // Marca apagada ou marca sem contexto: marca rank 0 = "não computável",
      // para a linha sair da fila em vez de ser reprocessada para sempre.
      const result = ctx
        ? appearanceRankFor(row.response || '', ctx.brandTerms, ctx.competitorTermsList)
        : null;
      const { error: upErr } = await supabaseAdmin
        .from('prompt_results')
        .update({
          appearance_rank: result ? result.rank : 0,
          appearance_rivals: result ? result.rivals : 0,
        })
        .eq('id', row.id);
      if (upErr) {
        logger.error({ err: upErr, id: row.id }, 'appearance-rank: update failed');
      } else {
        updated += 1;
      }
    }
    if (rows.length < BATCH_SIZE) break;
  }
  if (updated > 0) logger.info({ updated }, 'appearance-rank: rows enriched');
  return updated;
}

/** Agenda: a cada 30 min (só SQL/regex, custo zero) + warm-up no boot. */
export function startAppearanceRank() {
  const schedule = process.env.APPEARANCE_RANK_CRON || '*/30 * * * *';
  cron.schedule(schedule, () => {
    runAppearanceRankSweep().catch((err) => logger.error({ err }, 'appearance-rank sweep failed'));
  });
  setTimeout(() => {
    runAppearanceRankSweep().catch((err) =>
      logger.error({ err }, 'appearance-rank warm-up failed'),
    );
  }, 45_000);
  logger.info({ schedule }, 'appearance-rank active');
}
