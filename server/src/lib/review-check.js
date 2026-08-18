/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Checagem direta de plataformas de review — a fonte da dimensão 04 do
 * Índice de Citabilidade. O dado de 15/ago provou que as IAs quase não citam
 * plataformas de review nas respostas (0-9 citações por censo), então a nota
 * de Avaliações de Clientes não pode nascer das citações: nasce daqui
 * (régua do doc de 17/ago: presença/nota/volume nas plataformas do mercado).
 *
 * Postura honesta: cada checagem devolve found true/false/NULL — null é
 * "não conseguimos verificar" (plataforma bloqueou o robô) e aparece
 * DECLARADO na UI, nunca é tratado como ausência.
 *
 * Núcleo v1 (decisão de 17/ago): Reclame Aqui, Trustpilot, G2, Capterra.
 * Google Reviews exige API paga → BACKLOG. Lista por segmento via LLM é a
 * evolução v1.1 (registrada no BACKLOG §Reconciliação).
 *
 * Mecanismo (18/ago): as 4 plataformas devolvem 403 para IP de datacenter
 * (anti-bot) — o fetch direto não funciona do Railway. O mecanismo primário
 * é a SERP API do DataForSEO (fornecedor já usado p/ volume de busca):
 * consulta `"marca" site:plataforma` no Google BR e lê URL do perfil + nota
 * em estrela do resultado orgânico. O fetch direto fica como fallback para
 * ambientes sem DataForSEO (ex.: self-host em IP residencial).
 *
 * Agenda: semanal (REVIEW_CHECK_CRON, default seg 08:30 UTC) + warm-up no
 * boot quando a marca ainda não tem nenhuma checagem.
 */

import cron from 'node-cron';
import logger from './logger.js';

const FETCH_TIMEOUT_MS = 12_000;
const BETWEEN_BRANDS_MS = 3_000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function slugify(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return res;
}

/** "found: null" precisa de motivo nos logs — sem isso não dá pra diagnosticar. */
function logUnverifiable(platform, url, info) {
  logger.warn({ platform, url, ...info }, 'review-check: not verifiable');
}

// ---------------------------------------------------------------------------
// Mecanismo primário: SERP do Google BR via DataForSEO (sem 403 de anti-bot)
// ---------------------------------------------------------------------------

const SERP_URL = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
const BRAZIL_LOCATION_CODE = 2076;

/** Perfil típico de cada plataforma na SERP. `query(ctx)` monta a busca. */
const SERP_PLATFORMS = [
  {
    platform: 'reclame_aqui',
    profileRe: /reclameaqui\.com\.br\/empresa\//i,
    query: ({ name }) => `"${name}" site:reclameaqui.com.br`,
  },
  {
    platform: 'trustpilot',
    profileRe: /trustpilot\.com\/review\//i,
    // Perfis do Trustpilot são por domínio; nome fica de fallback.
    query: ({ name, domain }) => `"${domain || name}" site:trustpilot.com`,
  },
  {
    platform: 'g2',
    profileRe: /g2\.com\/products\//i,
    query: ({ name }) => `"${name}" site:g2.com`,
  },
  {
    platform: 'capterra',
    profileRe: /capterra\.com(\.br)?\/(p\/|reviews\/)/i,
    query: ({ name }) => `"${name}" (site:capterra.com OR site:capterra.com.br)`,
  },
];

function dataForSeoAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
}

/** Normaliza a nota da SERP para a escala 0-5 (RA aparece em 0-10). Pura. */
export function normalizeSerpRating(rating) {
  const value = Number.parseFloat(rating?.value ?? '');
  if (!Number.isFinite(value)) return null;
  const max = Number.parseFloat(rating?.rating_max ?? '') || 5;
  return Math.min(5, Math.round(((value * 5) / max) * 10) / 10);
}

/** Primeiro resultado orgânico cuja URL bate com o padrão de perfil. Pura. */
export function pickProfileHit(items, profileRe) {
  return (items || []).find((i) => i?.type === 'organic' && profileRe.test(i?.url || '')) || null;
}

/** Busca no Google BR; devolve os itens da SERP ou null (erro/sem config). */
async function serpSearch(query) {
  const auth = dataForSeoAuth();
  if (!auth) return null;
  const res = await fetch(SERP_URL, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { keyword: query, location_code: BRAZIL_LOCATION_CODE, language_code: 'pt', depth: 10 },
    ]),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  const data = await res.json();
  const task = data?.tasks?.[0];
  if (data?.status_code !== 20000 || task?.status_code !== 20000) {
    throw new Error(`DataForSEO: ${task?.status_message || data?.status_message || 'erro'}`);
  }
  return task?.result?.[0]?.items ?? [];
}

async function checkViaSerp(ctx, cfg) {
  const query = cfg.query(ctx);
  try {
    const items = await serpSearch(query);
    const hit = pickProfileHit(items, cfg.profileRe);
    if (!hit) return { platform: cfg.platform, url: null, found: false };
    return {
      platform: cfg.platform,
      url: hit.url,
      found: true,
      rating: normalizeSerpRating(hit.rating),
      review_count: Number.parseInt(hit.rating?.votes_count ?? '', 10) || null,
    };
  } catch (err) {
    logUnverifiable(cfg.platform, query, { err: err?.message, via: 'serp' });
    return { platform: cfg.platform, url: null, found: null };
  }
}

/** Extract aggregateRating from JSON-LD blocks in an HTML page. */
function ratingFromJsonLd(html) {
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    try {
      const raw = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const agg =
          node?.aggregateRating ||
          node?.['@graph']?.find?.((n) => n.aggregateRating)?.aggregateRating;
        if (agg?.ratingValue) {
          return {
            rating: Number.parseFloat(String(agg.ratingValue).replace(',', '.')) || null,
            reviewCount: Number.parseInt(agg.reviewCount ?? agg.ratingCount ?? '', 10) || null,
          };
        }
      }
    } catch {
      /* JSON-LD malformado — segue pro próximo bloco */
    }
  }
  return { rating: null, reviewCount: null };
}

/** Trustpilot: página pública por domínio; 200 = perfil existe, 404 = não. */
async function checkTrustpilot({ domain }) {
  const url = `https://br.trustpilot.com/review/${domain}`;
  try {
    const res = await fetchPage(url);
    if (res.status === 404) return { platform: 'trustpilot', url, found: false };
    if (!res.ok) {
      logUnverifiable('trustpilot', url, { status: res.status });
      return { platform: 'trustpilot', url, found: null };
    }
    const html = await res.text();
    const { rating, reviewCount } = ratingFromJsonLd(html);
    return { platform: 'trustpilot', url, found: true, rating, review_count: reviewCount };
  } catch (err) {
    logUnverifiable('trustpilot', url, { err: err?.message });
    return { platform: 'trustpilot', url, found: null };
  }
}

/** Reclame Aqui: API pública de busca de empresas; melhor match pelo nome. */
async function checkReclameAqui({ name }) {
  const searchUrl = `https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1/query/companiesSearch/${encodeURIComponent(name)}`;
  try {
    const res = await fetchPage(searchUrl);
    if (!res.ok) {
      logUnverifiable('reclame_aqui', searchUrl, { status: res.status });
      return { platform: 'reclame_aqui', url: null, found: null };
    }
    const data = await res.json();
    const companies = data?.companies ?? data?.data?.companies ?? [];
    if (!Array.isArray(companies) || companies.length === 0) {
      return { platform: 'reclame_aqui', url: null, found: false };
    }
    const target = slugify(name);
    const best =
      companies.find((c) => slugify(c.companyName || c.fantasyName || '').includes(target)) ||
      companies[0];
    const shortname = best.shortname || best.companyShortname || null;
    const url = shortname ? `https://www.reclameaqui.com.br/empresa/${shortname}/` : null;
    // O "score" do RA é 0-10; normalizamos para a escala 0-5 das demais.
    const score10 = Number.parseFloat(best.panelScore ?? best.finalScore ?? best.score ?? '');
    return {
      platform: 'reclame_aqui',
      url,
      found: true,
      rating: Number.isFinite(score10) ? Math.round((score10 / 2) * 10) / 10 : null,
      review_count: Number.parseInt(best.complainsCount ?? best.totalComplains ?? '', 10) || null,
    };
  } catch (err) {
    logUnverifiable('reclame_aqui', searchUrl, { err: err?.message });
    return { platform: 'reclame_aqui', url: null, found: null };
  }
}

/** G2 (B2B): página de produto por slug; costuma ter proteção anti-bot. */
async function checkG2({ name }) {
  const url = `https://www.g2.com/products/${slugify(name)}/reviews`;
  try {
    const res = await fetchPage(url);
    if (res.status === 404) return { platform: 'g2', url, found: false };
    if (!res.ok) {
      logUnverifiable('g2', url, { status: res.status });
      return { platform: 'g2', url, found: null };
    }
    const html = await res.text();
    const { rating, reviewCount } = ratingFromJsonLd(html);
    return { platform: 'g2', url, found: true, rating, review_count: reviewCount };
  } catch (err) {
    logUnverifiable('g2', url, { err: err?.message });
    return { platform: 'g2', url, found: null };
  }
}

/** Capterra (B2B): página de busca; proteção anti-bot comum → null. */
async function checkCapterra({ name }) {
  const url = `https://www.capterra.com/search/?query=${encodeURIComponent(name)}`;
  try {
    const res = await fetchPage(url);
    if (!res.ok) {
      logUnverifiable('capterra', url, { status: res.status });
      return { platform: 'capterra', url, found: null };
    }
    const html = await res.text();
    const target = slugify(name);
    const hasProduct = new RegExp(`/p/\\d+/[^"']*${target}`, 'i').test(html);
    return { platform: 'capterra', url, found: hasProduct ? true : false };
  } catch (err) {
    logUnverifiable('capterra', url, { err: err?.message });
    return { platform: 'capterra', url, found: null };
  }
}

/**
 * Nota v1 do D4 a partir das checagens (mapeamento da régua de quintis do
 * doc de 17/ago). Pura — exportada para testes e espelhada na action do web.
 * Retorna null quando NENHUMA plataforma pôde ser verificada (tudo unknown):
 * sem informação não se dá nota — a UI mantém o proxy declarado.
 */
export function reviewScoreFrom(rows) {
  const known = rows.filter((r) => r.found === true || r.found === false);
  if (known.length === 0) return null;
  const confirmed = rows.filter((r) => r.found === true);
  let score;
  if (confirmed.length === 0) score = 10;
  else if (confirmed.length === 1) score = 30;
  else if (confirmed.length <= 3) score = 50;
  else score = 65;
  const ratings = confirmed.map((r) => r.rating).filter((v) => Number.isFinite(v));
  if (ratings.length > 0) {
    const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    if (avg >= 4.5) score += 20;
    else if (avg >= 4.2) score += 10;
    else if (avg < 3.5) score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

/** Roda as 4 checagens para uma marca e grava em brand_review_checks. */
export async function runReviewChecksForBrand(brandId) {
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const { data: brand } = await supabaseAdmin
    .from('brands')
    .select('id, name, aliases')
    .eq('id', brandId)
    .single();
  if (!brand) return null;
  const { data: domains } = await supabaseAdmin
    .from('brand_domains')
    .select('domain')
    .eq('brand_id', brandId)
    .limit(1);
  const rawDomain = domains?.[0]?.domain || '';
  const domain = rawDomain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
  const ctx = { name: brand.name, domain };

  // SERP via DataForSEO quando configurado (Railway = IP de datacenter,
  // as plataformas devolvem 403 no fetch direto); senão, fetch direto.
  const rows = dataForSeoAuth()
    ? await Promise.all(SERP_PLATFORMS.map((cfg) => checkViaSerp(ctx, cfg)))
    : await Promise.all([
        checkReclameAqui(ctx),
        checkTrustpilot(ctx),
        checkG2(ctx),
        checkCapterra(ctx),
      ]);

  const now = new Date().toISOString();
  const upserts = rows.map((r) => ({
    brand_id: brandId,
    platform: r.platform,
    url: r.url ?? null,
    found: r.found,
    rating: r.rating ?? null,
    review_count: r.review_count ?? null,
    checked_at: now,
  }));
  const { error } = await supabaseAdmin
    .from('brand_review_checks')
    .upsert(upserts, { onConflict: 'brand_id,platform' });
  if (error) {
    logger.error({ err: error, brandId }, 'review-check: failed to save results');
    return null;
  }
  const score = reviewScoreFrom(rows);
  logger.info(
    { brandId, brand: brand.name, score, rows: rows.map((r) => `${r.platform}:${r.found}`) },
    'review-check: brand checked',
  );
  return { rows, score };
}

/** Varre todas as marcas ativas, com pausa entre elas (educação com as APIs). */
export async function runReviewChecksSweep() {
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const { data: brands } = await supabaseAdmin.from('brands').select('id').eq('is_active', true);
  for (const b of brands ?? []) {
    try {
      await runReviewChecksForBrand(b.id);
    } catch (err) {
      logger.error({ err, brandId: b.id }, 'review-check: brand sweep failed');
    }
    await new Promise((r) => setTimeout(r, BETWEEN_BRANDS_MS));
  }
}

/** Agenda semanal + warm-up no boot quando a tabela ainda está vazia. */
export function startReviewChecks() {
  const schedule = process.env.REVIEW_CHECK_CRON || '30 8 * * 1';
  cron.schedule(schedule, () => {
    runReviewChecksSweep().catch((err) => logger.error({ err }, 'review-check sweep failed'));
  });
  setTimeout(async () => {
    try {
      const { default: supabaseAdmin } = await import('../config/supabase.js');
      const { count } = await supabaseAdmin
        .from('brand_review_checks')
        .select('*', { count: 'exact', head: true });
      if ((count ?? 0) === 0) await runReviewChecksSweep();
    } catch (err) {
      logger.error({ err }, 'review-check warm-up failed');
    }
  }, 30_000);
  logger.info({ schedule }, 'review-check active');
}
