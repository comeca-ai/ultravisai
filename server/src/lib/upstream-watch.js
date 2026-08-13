/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Upstream watch: a cada 3 dias busca o site do upstream (ansvisor.com) e o
 * GitHub público (ansvisor/ansvisor) atrás de novidades — commits recentes,
 * release nova, mudança na home — e expõe o resultado pro painel /ops.
 * Somos um fork ~15 migrations atrás; saber o que o upstream lança orienta o
 * "sync seletivo" do backlog sem ninguém precisar vigiar manualmente.
 *
 * Sem estado em banco: o snapshot vive em memória (refresh no boot + cron a
 * cada 3 dias + refresh preguiçoso quando o /ops pede e o cache está velho).
 * A comparação de site usa title+description — sobrevive a rebuilds que só
 * trocam hashes de asset.
 */

import cron from 'node-cron';
import logger from './logger.js';

const REPO = 'ansvisor/ansvisor';
const SITE_URL = 'https://www.ansvisor.com/';
const RECENT_DAYS = 3;
const FETCH_TIMEOUT_MS = 15_000;
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

let cache = null;

/**
 * Pure summary for display/tests: which of the snapshot counts as "news".
 *
 * @param {{ commits?: {date: string}[], siteChanged?: boolean|null }} snap
 * @param {Date} now
 */
export function summarizeUpstream(snap, now = new Date()) {
  const cutoff = now.getTime() - RECENT_DAYS * 86_400_000;
  const recentCommits = (snap.commits ?? []).filter(
    (c) => c.date && new Date(c.date).getTime() >= cutoff,
  ).length;
  return {
    recentCommits,
    hasNews: recentCommits > 0 || snap.siteChanged === true,
  };
}

async function fetchWithTimeout(url, headers = {}) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; UltravisBot/1.0; +https://ultravis.ai)',
      ...headers,
    },
  });
}

async function collect() {
  const snap = {
    fetchedAt: new Date().toISOString(),
    site: null,
    siteChanged: null,
    commits: [],
    release: null,
  };

  try {
    const res = await fetchWithTimeout(SITE_URL, { accept: 'text/html' });
    const html = await res.text();
    const title = (/<title[^>]*>([^<]*)/i.exec(html)?.[1] ?? '').trim();
    const description =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ?? '';
    const sig = `${title}|${description}`;
    snap.site = { ok: res.ok, status: res.status, title, description, sig };
    if (cache?.site?.sig) snap.siteChanged = cache.site.sig !== sig;
  } catch (err) {
    snap.site = { ok: false, error: String(err?.message || err) };
  }

  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${REPO}/commits?per_page=10`, {
      accept: 'application/vnd.github+json',
    });
    if (res.ok) {
      const rows = await res.json();
      snap.commits = (Array.isArray(rows) ? rows : []).map((c) => ({
        sha: (c.sha || '').slice(0, 7),
        date: c.commit?.author?.date || null,
        message: (c.commit?.message || '').split('\n')[0].slice(0, 110),
      }));
    }
  } catch {
    /* best-effort */
  }

  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${REPO}/releases/latest`, {
      accept: 'application/vnd.github+json',
    });
    if (res.ok) {
      const rel = await res.json();
      snap.release = { tag: rel.tag_name, name: rel.name, publishedAt: rel.published_at };
    }
  } catch {
    /* best-effort */
  }

  cache = snap;
  return snap;
}

/** Cached snapshot for the /ops panel; refreshes lazily when stale. */
export async function getUpstreamNews(maxAgeMs = CACHE_MAX_AGE_MS) {
  if (cache && Date.now() - new Date(cache.fetchedAt).getTime() < maxAgeMs) return cache;
  try {
    return await collect();
  } catch {
    return cache;
  }
}

/** Start the periodic check. Safe to call unconditionally at boot. */
export function startUpstreamWatch() {
  cron.schedule('0 9 */3 * *', async () => {
    try {
      const snap = await collect();
      const s = summarizeUpstream(snap);
      logger.info(
        { commits: snap.commits.length, recent: s.recentCommits, siteOk: snap.site?.ok ?? false },
        'upstream watch refreshed',
      );
    } catch (err) {
      logger.error({ err }, 'upstream watch failed');
    }
  });
  // Warm the cache shortly after boot so /ops has data on first view.
  setTimeout(() => {
    collect()
      .then((snap) =>
        logger.info(
          {
            commits: snap.commits.length,
            siteOk: snap.site?.ok ?? false,
            siteTitle: snap.site?.title ?? null,
            release: snap.release?.tag ?? null,
          },
          'upstream watch: primeira coleta',
        ),
      )
      .catch(() => {});
  }, 15_000);
  logger.info('upstream watch active (site + GitHub do upstream, a cada 3 dias)');
}
