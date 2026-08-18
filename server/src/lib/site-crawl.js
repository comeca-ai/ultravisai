/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Varredura multi-página do site — estende a dimensão 01 do Índice de
 * Citabilidade (Legibilidade do Site) de "1 página auditada" para "as ~10
 * páginas-chave do site", como pede a régua do doc de 17/ago ("Org schema em
 * 8/10 páginas").
 *
 * Reuso do core (só imports, nenhuma modificação): buildAuditContext →
 * runSignals → scoreAudit dão a nota determinística de cada página (os
 * sinais de LLM ficam de fora da varredura — custo; a auditoria single-page
 * continua sendo o lugar deles).
 *
 * Descoberta de páginas: sitemap.xml (com suporte a sitemap index); sem
 * sitemap, âncoras da homepage. Seleção: homepage + padrões de páginas-chave
 * (sobre, produtos/serviços, preços, FAQ, contato, blog, cases) + caminhos
 * mais curtos, até 10 páginas.
 *
 * Custo: cada página passa pelo Scrape.do com render (mesmo caminho da
 * auditoria) — por isso o default é MENSAL (dia 1, 09:00 UTC); ajuste via
 * SITE_CRAWL_CRON. Warm-up no boot quando ainda não há nenhuma varredura.
 */

import cron from 'node-cron';
import logger from './logger.js';
import { fetchText } from './audit/fetcher.js';
import { buildAuditContext } from './audit/context.js';
import { runSignals } from './audit/engine.js';
import { scoreAudit } from './audit/scorer.js';

const MAX_PAGES = 10;
const BETWEEN_PAGES_MS = 2_000;
const BETWEEN_BRANDS_MS = 5_000;
const MAX_SITEMAP_LOCS = 500;

/** Padrões de páginas-chave, em ordem de prioridade (pt-BR + en). */
const PRIORITY_PATTERNS = [
  /(sobre|about|quem-somos|empresa|company)/,
  /(servic|service|produt|product|solu)/,
  /(preco|pricing|plano)/,
  /(faq|ajuda|help|duvida|pergunta)/,
  /(contato|contact|fale-conosco)/,
  /(blog|artigo|conteudo|insight|noticia)/,
  /(case|cliente|portfolio|depoimento)/,
];

const NON_PAGE_RE = /\.(pdf|jpe?g|png|gif|webp|svg|ico|xml|zip|mp4|webm|css|js|json|txt)$/i;

/** Extrai as <loc> de um sitemap XML. Pura. */
export function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml || '')) !== null) {
    locs.push(m[1].replace(/&amp;/g, '&'));
  }
  return locs;
}

/**
 * Seleciona até `max` páginas-chave: homepage primeiro, depois uma por padrão
 * de prioridade, depois os caminhos mais curtos. Só URLs do mesmo host. Pura.
 */
export function pickKeyPages(homeUrl, candidates, max = MAX_PAGES) {
  let home;
  try {
    home = new URL(homeUrl);
  } catch {
    return [];
  }
  const seen = new Set();
  const norm = [];
  for (const raw of candidates || []) {
    let u;
    try {
      u = new URL(String(raw), home.origin);
    } catch {
      continue;
    }
    if (u.host !== home.host) continue;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
    u.hash = '';
    u.search = '';
    if (NON_PAGE_RE.test(u.pathname)) continue;
    const s = u.toString();
    const key = s.replace(/\/+$/, '');
    if (key === home.origin || seen.has(key)) continue;
    seen.add(key);
    norm.push({ url: s, path: u.pathname.toLowerCase() });
  }

  const picked = [homeUrl];
  const used = new Set();
  for (const re of PRIORITY_PATTERNS) {
    if (picked.length >= max) break;
    const hit = norm.find((c) => !used.has(c.url) && re.test(c.path));
    if (hit) {
      used.add(hit.url);
      picked.push(hit.url);
    }
  }
  const rest = norm
    .filter((c) => !used.has(c.url))
    .sort(
      (a, b) =>
        a.path.split('/').filter(Boolean).length - b.path.split('/').filter(Boolean).length ||
        a.path.length - b.path.length,
    );
  for (const c of rest) {
    if (picked.length >= max) break;
    picked.push(c.url);
  }
  return picked;
}

/**
 * Cobertura por sinal: em quantas páginas avaliadas cada sinal passou
 * ("Org schema em 8/10 páginas"). Pura.
 */
export function aggregateCoverage(pages) {
  const cov = {};
  for (const p of pages || []) {
    for (const [key, status] of Object.entries(p.signals || {})) {
      if (status === 'na') continue;
      cov[key] = cov[key] || { pass: 0, evaluated: 0 };
      cov[key].evaluated += 1;
      if (status === 'pass') cov[key].pass += 1;
    }
  }
  return cov;
}

/** Sitemap (com index) → lista de URLs; fallback: âncoras da homepage. */
async function discoverCandidates(origin, homeCtx) {
  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    let xml;
    try {
      xml = await fetchText(origin + path);
    } catch {
      xml = null;
    }
    if (!xml) continue;
    let locs = parseSitemapLocs(xml);
    if (locs.length > 0 && locs.every((l) => /\.xml(\?|$)/i.test(l))) {
      const children = locs.slice(0, 3);
      locs = [];
      for (const child of children) {
        try {
          const childXml = await fetchText(child);
          if (childXml) locs.push(...parseSitemapLocs(childXml));
        } catch {
          /* filho inacessível — segue */
        }
        if (locs.length >= MAX_SITEMAP_LOCS) break;
      }
    }
    if (locs.length > 0) return locs.slice(0, MAX_SITEMAP_LOCS);
  }
  const anchors = [];
  homeCtx.$('a[href]').each((_, el) => {
    anchors.push(homeCtx.$(el).attr('href'));
  });
  return anchors;
}

/** Roda a varredura completa de uma marca e grava em site_crawls. */
export async function runSiteCrawlForBrand(brandId) {
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const { data: domains } = await supabaseAdmin
    .from('brand_domains')
    .select('domain')
    .eq('brand_id', brandId)
    .limit(1);
  const rawDomain = domains?.[0]?.domain || '';
  const domain = rawDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return null;
  const origin = `https://${domain}`;
  const homeUrl = `${origin}/`;

  const homeCtx = await buildAuditContext(homeUrl);
  const candidates = await discoverCandidates(origin, homeCtx);
  const urls = pickKeyPages(homeUrl, candidates);

  const pages = [];
  for (const url of urls) {
    try {
      const ctx = url === homeUrl ? homeCtx : await buildAuditContext(url);
      const results = await runSignals(ctx);
      const { totalScore } = scoreAudit(results);
      pages.push({
        url,
        score: totalScore === null ? null : Math.round(totalScore * 100),
        signals: Object.fromEntries(results.map((r) => [r.key, r.status])),
      });
    } catch (err) {
      pages.push({ url, score: null, signals: {}, error: err.message });
    }
    await new Promise((r) => setTimeout(r, BETWEEN_PAGES_MS));
  }

  const scored = pages.filter((p) => typeof p.score === 'number');
  const score =
    scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : null;
  const coverage = aggregateCoverage(pages);

  const { error } = await supabaseAdmin.from('site_crawls').insert({
    brand_id: brandId,
    origin,
    page_count: pages.length,
    pages_scored: scored.length,
    score,
    pages,
    coverage,
  });
  if (error) {
    logger.error({ err: error, brandId }, 'site-crawl: failed to save');
    return null;
  }
  logger.info(
    { brandId, origin, score, pages: pages.length, scored: scored.length },
    'site-crawl: brand crawled',
  );
  return { score, pages: pages.length };
}

/** Varre todas as marcas ativas, com pausa entre elas. */
export async function runSiteCrawlSweep() {
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const { data: brands } = await supabaseAdmin.from('brands').select('id').eq('is_active', true);
  for (const b of brands ?? []) {
    try {
      await runSiteCrawlForBrand(b.id);
    } catch (err) {
      logger.error({ err, brandId: b.id }, 'site-crawl: brand sweep failed');
    }
    await new Promise((r) => setTimeout(r, BETWEEN_BRANDS_MS));
  }
}

/** Agenda mensal (custo de proxy) + warm-up no boot quando não há varredura. */
export function startSiteCrawl() {
  const schedule = process.env.SITE_CRAWL_CRON || '0 9 1 * *';
  cron.schedule(schedule, () => {
    runSiteCrawlSweep().catch((err) => logger.error({ err }, 'site-crawl sweep failed'));
  });
  // 90s depois do boot — atrás do warm-up do review-check (30s) de propósito.
  setTimeout(async () => {
    try {
      const { default: supabaseAdmin } = await import('../config/supabase.js');
      const { count } = await supabaseAdmin
        .from('site_crawls')
        .select('*', { count: 'exact', head: true });
      if ((count ?? 0) === 0) await runSiteCrawlSweep();
    } catch (err) {
      logger.error({ err }, 'site-crawl warm-up failed');
    }
  }, 90_000);
  logger.info({ schedule }, 'site-crawl active');
}
