'use server';

/**
 * Ultravis addition (fork layer — additive file, no core changes).
 *
 * Índice de Visibilidade — data source for the /dashboard/citability page v2.
 * Computes, from `prompt_results` alone (no new collection pipelines):
 *
 * - D2 (Conteúdo próprio): share of AI answers citing the brand's own domain,
 *   normalized against the 10% ceiling observed across real censuses
 *   (best real-world case measured: 7.4% — see DECISOES 15/ago).
 * - D3–D6 (Social / Avaliações / Mídia aberta / Verticais): scored RELATIVE
 *   to the sector's "gabarito" — among the answers that cite sources of that
 *   category, in how many is the brand present (mentioned or cited)?
 * - Share de resposta per platform, with the totals that let the UI print the
 *   reconciliation line (the per-platform sum IS the overall share).
 * - Weekly evolution of every dimension, so the page can chart the index
 *   over the censuses.
 *
 * D1 (Site técnico) comes from the Site Audit trend (`getAuditTrend`), same
 * source as the Auditoria page — the page combines both.
 *
 * Formula weights live in `web/src/config/visibility-index.ts` and are
 * deliberately configurable: the framework owner may recalibrate them
 * (estrategia/indice-citabilidade.md is the canonical source).
 */

import { createClient } from '@/lib/supabase/server';
import type { Citation } from '@/types';
import {
  classifyDomain,
  extractHostname,
  normalizeDomain,
  type SourceCategory,
} from '@/lib/citations/classify';
import { INDEX_DIMENSIONS, type IndexDimKey } from '@/config/visibility-index';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisibilityIndexPreset = '7d' | '30d' | 'all';

/** Category groups feeding dims 03–06 (classifier categories → dimension). */
export type IndexCategoryKey = 'social' | 'reviews' | 'media' | 'verticals';

export interface IndexSourceRow {
  domain: string;
  citations: number;
  /** True when the brand appears in at least one answer citing this domain. */
  youAppear: boolean;
}

export interface IndexCategoryData {
  /** 0–100 — share of gabarito answers where the brand is present. */
  score: number;
  /** Citations in this category in the window (directional badge when < 10). */
  sampleCitations: number;
  /** Answers citing ≥1 source of this category. */
  answersCiting: number;
  /** Of those, answers where the brand is present. */
  answersWithBrand: number;
  /** Top cited domains of the category — the visible "fontes pesquisadas". */
  topSources: IndexSourceRow[];
}

export interface ReviewCheckRow {
  platform: string;
  url: string | null;
  found: boolean | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface VisibilityIndexData {
  totals: { results: number; citations: number };
  d2: {
    /** 0–100 — own-citation share normalized (10% of answers ⇒ 100). */
    score: number;
    pctOwn: number;
    resultsCitingOwn: number;
    ownDomains: string[];
  };
  categories: Record<IndexCategoryKey, IndexCategoryData>;
  share: {
    mentioned: number;
    total: number;
    byPlatform: Array<{ platform: string; mentioned: number; total: number }>;
    /** Share direto: respostas a prompts que citam a marca pelo nome. */
    direct: { mentioned: number; total: number };
    /** Share orgânico: respostas a prompts de categoria. */
    organic: { mentioned: number; total: number };
  };
  /**
   * Effective dimension weights (%): calibrated values from `index_weights`
   * (edited only via the /ops panel) over the framework defaults.
   */
  weights: Record<IndexDimKey, number>;
  /**
   * Checagem direta de plataformas de review (migration 00041) — quando
   * existe, é ela que dá a nota do D4; score null = nada verificável
   * (a UI mantém o proxy declarado).
   */
  reviewCheck: { score: number | null; rows: ReviewCheckRow[]; checkedAt: string | null } | null;
  /**
   * Varredura multi-página do site (migration 00042) — quando existe, é ela
   * que dá a nota do D1 (média das páginas-chave); sem varredura a UI usa o
   * Site Audit single-page como antes. `coverage` = "Schema.org em 8/10
   * páginas" por sinal.
   */
  siteCrawl: {
    score: number | null;
    pageCount: number;
    pagesScored: number;
    origin: string;
    coverage: Record<string, { pass: number; evaluated: number }>;
    createdAt: string;
  } | null;
  /**
   * Score de Visibilidade (resultado) — dimensões medidas das respostas de
   * IA na janela. Autoridade e Acurácia (juiz LLM) ainda não existem e a
   * página declara isso. Posição/Sentimento: null = marca nunca apareceu.
   */
  resultScore: {
    citation: number;
    presence: number;
    /**
     * Posição por ordem de aparição (premissa 18/ago): distribuição de
     * respostas em que a marca foi citada em 1º/2º/3º/4º+ lugar, e nota B
     * (pódio ponderado: 1º=100 · 2º=60 · 3º=30 · 4º+=0). samples = respostas
     * com rank calculado; null = nenhuma ainda.
     */
    position: {
      score: number | null;
      samples: number;
      dist: { p1: number; p2: number; p3: number; p4: number };
    };
    sentiment: {
      score: number | null;
      pos: number;
      neu: number;
      neg: number;
      /** Fontes pesquisadas: placar de sentimento por motor (respostas com a marca). */
      byPlatform: Array<{ platform: string; pos: number; neu: number; neg: number }>;
    };
  };
  /** Weekly (Monday-keyed) dimension scores over ALL history, oldest first. */
  evolution: Array<{
    weekStart: string;
    d2: number;
    social: number;
    reviews: number;
    media: number;
    verticals: number;
  }>;
}

// ─── Scoring rules (v1 — decided 15/ago, pending Igor's logic doc) ───────────

/** Own-citation % that maps to a 100 score (real-world best observed: 7.4%). */
const OWN_CITATION_CEILING_PCT = 10;

/** Classifier categories feeding each dimension. */
const CATEGORY_GROUPS: Record<IndexCategoryKey, SourceCategory[]> = {
  social: ['social'],
  reviews: ['review', 'forum'],
  media: ['editorial', 'other'],
  verticals: ['institutional'],
};

const TOP_SOURCES_LIMIT = 4;
const SCAN_PAGE_SIZE = 1000;
const SCAN_MAX_ROWS = 50_000;

function ownCitationScore(pctOwn: number): number {
  return Math.min(100, Math.round((pctOwn / OWN_CITATION_CEILING_PCT) * 100));
}

function gabaritoScore(answersWithBrand: number, answersCiting: number): number {
  if (answersCiting === 0) return 0;
  return Math.round((answersWithBrand / answersCiting) * 100);
}

/**
 * Nota v1 do D4 a partir das checagens diretas — ESPELHO de
 * `server/src/lib/review-check.js#reviewScoreFrom` (mesma régua, mesmos
 * números; mudanças devem ser feitas nos dois). null = nada verificável.
 */
function reviewScoreFrom(rows: ReviewCheckRow[]): number | null {
  const known = rows.filter((r) => r.found === true || r.found === false);
  if (known.length === 0) return null;
  const confirmed = rows.filter((r) => r.found === true);
  let score: number;
  if (confirmed.length === 0) score = 10;
  else if (confirmed.length === 1) score = 30;
  else if (confirmed.length <= 3) score = 50;
  else score = 65;
  const ratings = confirmed
    .map((r) => r.rating)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (ratings.length > 0) {
    const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    if (avg >= 4.5) score += 20;
    else if (avg >= 4.2) score += 10;
    else if (avg < 3.5) score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

/** Monday of the week of `iso`, as YYYY-MM-DD. */
function weekStartOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

// ─── Main action ──────────────────────────────────────────────────────────────

interface ResultRow {
  id: string;
  prompt_id: string;
  platform: string | null;
  mention_count: number | null;
  created_at: string;
  citations: Citation[] | null;
  sentiment: string | null;
  /** Rank por ordem de aparição (migration 00043): 1 = citada primeiro; 0 = não computável; null = enriquecimento pendente. */
  appearance_rank: number | null;
}

export async function getVisibilityIndex(
  brandId: string,
  preset: VisibilityIndexPreset,
): Promise<VisibilityIndexData> {
  const supabase = await createClient();

  const [{ data: brandDomainRows }, { data: competitorRows }, { data: weightRows }] =
    await Promise.all([
      supabase.from('brand_domains').select('domain').eq('brand_id', brandId),
      supabase.from('competitors').select('domain').eq('brand_id', brandId),
      supabase.from('index_weights').select('dim_key, weight'),
    ]);

  const weights = Object.fromEntries(INDEX_DIMENSIONS.map((d) => [d.key, d.weight])) as Record<
    IndexDimKey,
    number
  >;
  for (const r of weightRows ?? []) {
    if (r.dim_key in weights) weights[r.dim_key as IndexDimKey] = r.weight;
  }
  const brandDomains = (brandDomainRows ?? [])
    .map((r) => normalizeDomain((r as { domain: string }).domain))
    .filter(Boolean);
  const competitorDomains = (competitorRows ?? [])
    .map((r) => normalizeDomain((r as { domain: string }).domain))
    .filter(Boolean);
  const classifyCtx = { brandDomains, competitorDomains };

  // Prompts de marca (share direto × orgânico — migration 00040). Dois passos
  // simples em vez de join para manter a tipagem direta.
  const { data: setRows } = await supabase.from('prompt_sets').select('id').eq('brand_id', brandId);
  const setIds = (setRows ?? []).map((s) => s.id);
  const brandPromptIds = new Set<string>();
  if (setIds.length > 0) {
    const { data: bpRows } = await supabase
      .from('prompts')
      .select('id')
      .in('prompt_set_id', setIds)
      .eq('is_brand_prompt', true);
    for (const r of bpRows ?? []) brandPromptIds.add(r.id);
  }

  // Checagem direta de reviews (D4) — coletada semanalmente pelo server.
  const { data: reviewRows } = await supabase
    .from('brand_review_checks')
    .select('platform, url, found, rating, review_count, checked_at')
    .eq('brand_id', brandId);
  const reviewCheck =
    reviewRows && reviewRows.length > 0
      ? {
          rows: reviewRows.map((r) => ({
            platform: r.platform,
            url: r.url,
            found: r.found,
            rating: r.rating,
            reviewCount: r.review_count,
          })),
          score: reviewScoreFrom(
            reviewRows.map((r) => ({
              platform: r.platform,
              url: r.url,
              found: r.found,
              rating: r.rating,
              reviewCount: r.review_count,
            })),
          ),
          checkedAt: reviewRows[0]?.checked_at ?? null,
        }
      : null;

  // Varredura multi-página (D1) — última varredura da marca, se houver.
  const { data: crawlRows } = await supabase
    .from('site_crawls')
    .select('origin, page_count, pages_scored, score, coverage, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1);
  const crawlRow = crawlRows?.[0] ?? null;
  const siteCrawl = crawlRow
    ? {
        score: crawlRow.score === null ? null : Math.round(Number(crawlRow.score)),
        pageCount: crawlRow.page_count ?? 0,
        pagesScored: crawlRow.pages_scored ?? 0,
        origin: crawlRow.origin,
        coverage: (crawlRow.coverage ?? {}) as Record<string, { pass: number; evaluated: number }>,
        createdAt: crawlRow.created_at,
      }
    : null;

  const from =
    preset === 'all'
      ? null
      : new Date(Date.now() - (preset === '7d' ? 7 : 30) * 24 * 3600 * 1000).toISOString();

  // Aggregation state. The window aggregates feed the scores; the weekly
  // aggregates (always over full history) feed the evolution chart.
  interface CatAgg {
    citations: number;
    answersCiting: number;
    answersWithBrand: number;
    domains: Map<string, { citations: number; youAppear: boolean }>;
  }
  const emptyCat = (): CatAgg => ({
    citations: 0,
    answersCiting: 0,
    answersWithBrand: 0,
    domains: new Map(),
  });
  const cats: Record<IndexCategoryKey, CatAgg> = {
    social: emptyCat(),
    reviews: emptyCat(),
    media: emptyCat(),
    verticals: emptyCat(),
  };
  let winResults = 0;
  let winCitations = 0;
  let winCitingOwn = 0;
  const platformAgg = new Map<string, { mentioned: number; total: number }>();
  const directAgg = { mentioned: 0, total: 0 };
  const organicAgg = { mentioned: 0, total: 0 };
  // Score de Visibilidade (resultado) — Posição e Sentimento medem só as
  // respostas em que a marca aparece ("quando aparece, como aparece").
  // Posição = ORDEM DE APARIÇÃO no texto (premissa de 18/ago): distribuição
  // de 1º/2º/3º/4º+ pré-calculada pelo server (appearance_rank).
  const sentAgg = { pos: 0, neu: 0, neg: 0 };
  // Fontes pesquisadas do Sentimento: placar por motor (pedido de 19/ago).
  const sentByPlatform = new Map<string, { pos: number; neu: number; neg: number }>();
  const posDist = { p1: 0, p2: 0, p3: 0, p4: 0 };

  interface WeekAgg {
    results: number;
    citingOwn: number;
    cat: Record<IndexCategoryKey, { answersCiting: number; answersWithBrand: number }>;
  }
  const weeks = new Map<string, WeekAgg>();
  const domainClassCache = new Map<string, SourceCategory>();

  const groupOf = (category: SourceCategory): IndexCategoryKey | null => {
    for (const key of Object.keys(CATEGORY_GROUPS) as IndexCategoryKey[]) {
      if (CATEGORY_GROUPS[key].includes(category)) return key;
    }
    return null;
  };

  const aggregate = (r: ResultRow) => {
    const citations = Array.isArray(r.citations) ? r.citations : [];
    const inWindow = !from || r.created_at >= from;

    // Distinct domains cited by this answer, with their category.
    const domainCat = new Map<string, SourceCategory>();
    let citationCount = 0;
    for (const cite of citations) {
      const host = extractHostname(cite.url);
      if (!host) continue;
      citationCount += 1;
      if (!domainCat.has(host)) {
        let cat = domainClassCache.get(host);
        if (cat === undefined) {
          cat = classifyDomain(host, classifyCtx);
          domainClassCache.set(host, cat);
        }
        domainCat.set(host, cat);
      }
    }
    const ownCited = Array.from(domainCat.values()).some((c) => c === 'you');
    const brandPresent = (r.mention_count ?? 0) > 0 || ownCited;

    // Category groups touched by this answer.
    const touched = new Set<IndexCategoryKey>();
    for (const cat of domainCat.values()) {
      const g = groupOf(cat);
      if (g) touched.add(g);
    }

    // Weekly aggregates — always over the full history.
    const wk = weekStartOf(r.created_at);
    const w = weeks.get(wk) ?? {
      results: 0,
      citingOwn: 0,
      cat: {
        social: { answersCiting: 0, answersWithBrand: 0 },
        reviews: { answersCiting: 0, answersWithBrand: 0 },
        media: { answersCiting: 0, answersWithBrand: 0 },
        verticals: { answersCiting: 0, answersWithBrand: 0 },
      },
    };
    w.results += 1;
    if (ownCited) w.citingOwn += 1;
    for (const g of touched) {
      w.cat[g].answersCiting += 1;
      if (brandPresent) w.cat[g].answersWithBrand += 1;
    }
    weeks.set(wk, w);

    if (!inWindow) return;

    // Windowed aggregates.
    winResults += 1;
    winCitations += citationCount;
    if (ownCited) winCitingOwn += 1;

    const platform = r.platform || 'other';
    const p = platformAgg.get(platform) ?? { mentioned: 0, total: 0 };
    p.total += 1;
    if ((r.mention_count ?? 0) > 0) p.mentioned += 1;
    platformAgg.set(platform, p);

    const bucket = brandPromptIds.has(r.prompt_id) ? directAgg : organicAgg;
    bucket.total += 1;
    if ((r.mention_count ?? 0) > 0) bucket.mentioned += 1;

    // Posição + Sentimento (Score de Visibilidade) — só respostas com a marca.
    const mc = r.mention_count ?? 0;
    if (mc > 0) {
      const sp = sentByPlatform.get(platform) ?? { pos: 0, neu: 0, neg: 0 };
      if (r.sentiment === 'positive') {
        sentAgg.pos += 1;
        sp.pos += 1;
      } else if (r.sentiment === 'negative') {
        sentAgg.neg += 1;
        sp.neg += 1;
      } else {
        sentAgg.neu += 1;
        sp.neu += 1;
      }
      sentByPlatform.set(platform, sp);

      // rank >= 1 = calculado; 0 = não computável; null = pendente (o
      // enriquecimento do server preenche em até 30 min).
      const rank = r.appearance_rank;
      if (typeof rank === 'number' && rank >= 1) {
        if (rank === 1) posDist.p1 += 1;
        else if (rank === 2) posDist.p2 += 1;
        else if (rank === 3) posDist.p3 += 1;
        else posDist.p4 += 1;
      }
    }

    for (const g of touched) {
      cats[g].answersCiting += 1;
      if (brandPresent) cats[g].answersWithBrand += 1;
    }
    for (const [host, cat] of domainCat) {
      const g = groupOf(cat);
      if (!g) continue;
      const d = cats[g].domains.get(host) ?? { citations: 0, youAppear: false };
      if (brandPresent) d.youAppear = true;
      cats[g].domains.set(host, d);
    }
    // Citation counts per category (sample size uses citations, not answers).
    for (const cite of citations) {
      const host = extractHostname(cite.url);
      if (!host) continue;
      const cat = domainCat.get(host);
      const g = cat ? groupOf(cat) : null;
      if (!g) continue;
      cats[g].citations += 1;
      const d = cats[g].domains.get(host);
      if (d) d.citations += 1;
    }
  };

  // Page through all results for the brand (full history — weekly evolution
  // needs it; the window filter is applied in-memory per row).
  for (let offset = 0; offset < SCAN_MAX_ROWS; offset += SCAN_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('prompt_results')
      .select(
        'id, prompt_id, platform, mention_count, created_at, citations, sentiment, appearance_rank',
      )
      .eq('brand_id', brandId)
      .neq('platform', 'chatgpt-shopping')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + SCAN_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as unknown as ResultRow[];
    for (const r of batch) aggregate(r);
    if (batch.length < SCAN_PAGE_SIZE) break;
  }

  const pctOwn = winResults > 0 ? Math.round((winCitingOwn / winResults) * 1000) / 10 : 0;

  const categoryOut = (key: IndexCategoryKey): IndexCategoryData => {
    const c = cats[key];
    const topSources = Array.from(c.domains.entries())
      .map(([domain, d]) => ({ domain, citations: d.citations, youAppear: d.youAppear }))
      .sort((a, b) => b.citations - a.citations)
      .slice(0, TOP_SOURCES_LIMIT);
    return {
      score: gabaritoScore(c.answersWithBrand, c.answersCiting),
      sampleCitations: c.citations,
      answersCiting: c.answersCiting,
      answersWithBrand: c.answersWithBrand,
      topSources,
    };
  };

  const byPlatform = Array.from(platformAgg.entries())
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.total - a.total);
  const mentioned = byPlatform.reduce((s, p) => s + p.mentioned, 0);

  const evolution = Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, w]) => ({
      weekStart,
      d2: ownCitationScore(w.results > 0 ? (w.citingOwn / w.results) * 100 : 0),
      social: gabaritoScore(w.cat.social.answersWithBrand, w.cat.social.answersCiting),
      reviews: gabaritoScore(w.cat.reviews.answersWithBrand, w.cat.reviews.answersCiting),
      media: gabaritoScore(w.cat.media.answersWithBrand, w.cat.media.answersCiting),
      verticals: gabaritoScore(w.cat.verticals.answersWithBrand, w.cat.verticals.answersCiting),
    }));

  return {
    totals: { results: winResults, citations: winCitations },
    d2: {
      score: ownCitationScore(pctOwn),
      pctOwn,
      resultsCitingOwn: winCitingOwn,
      ownDomains: brandDomains,
    },
    categories: {
      social: categoryOut('social'),
      reviews: categoryOut('reviews'),
      media: categoryOut('media'),
      verticals: categoryOut('verticals'),
    },
    share: { mentioned, total: winResults, byPlatform, direct: directAgg, organic: organicAgg },
    weights,
    reviewCheck,
    siteCrawl,
    resultScore: {
      citation: ownCitationScore(pctOwn),
      presence: winResults > 0 ? Math.round((mentioned / winResults) * 100) : 0,
      position: (() => {
        const samples = posDist.p1 + posDist.p2 + posDist.p3 + posDist.p4;
        if (samples === 0) return { score: null, samples: 0, dist: posDist };
        // Nota B (decisão do dono, 18/ago): pódio ponderado por degrau.
        const score = Math.round((posDist.p1 * 100 + posDist.p2 * 60 + posDist.p3 * 30) / samples);
        return { score, samples, dist: posDist };
      })(),
      sentiment: (() => {
        const byPlatform = Array.from(sentByPlatform.entries())
          .map(([platform, s]) => ({ platform, ...s }))
          .sort((a, b) => b.pos + b.neu + b.neg - (a.pos + a.neu + a.neg));
        const total = sentAgg.pos + sentAgg.neu + sentAgg.neg;
        if (total === 0) return { score: null, pos: 0, neu: 0, neg: 0, byPlatform };
        return {
          score: Math.round((sentAgg.pos * 100 + sentAgg.neu * 50) / total),
          ...sentAgg,
          byPlatform,
        };
      })(),
    },
    evolution,
  };
}
