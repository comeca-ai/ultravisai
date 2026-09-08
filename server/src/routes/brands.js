import { Router } from 'express';
import * as cheerio from 'cheerio';
import { generateText } from 'ai';
import { resolveModel } from '../lib/ai-provider.js';
import { withRetry } from '../lib/retry.js';
import { getLanguageName } from '../lib/languages.js';
import { validarUrlExterna } from '../lib/ssrf-guard.js';

const router = Router();

const FETCH_TIMEOUT_MS = 10_000;
const MAX_SITE_TEXT_CHARS = 8000;

/** Coerce user input ("datarisk.io", "polar.com/br/") to a fetchable URL. */
export function normalizeWebsiteUrl(website) {
  const trimmed = String(website).trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    // Keep the typed path (dropping only query/hash): "polar.com/br" is a
    // different storefront than "polar.com" — stripping it made the AI read
    // the global homepage and produce a generic description (QA, 11/ago).
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}${path ? '' : '/'}`;
  } catch {
    return null;
  }
}

/**
 * Fetch the homepage and reduce it to the text an LLM needs: title, meta
 * description, headings and meaningful paragraphs, deduped and capped.
 * JS-heavy SPAs render little body text — the meta tags usually still carry
 * the positioning, which is enough for a first-draft description.
 */
async function fetchSiteText(url) {
  const urlValidada = await validarUrlExterna(url);
  const res = await fetch(urlValidada, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; UltravisBot/1.0; +https://ultravis.ai)',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`site returned HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, nav, footer').remove();

  const title = $('title').first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';
  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const paragraphs = $('p, li')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 40)
    .slice(0, 60);

  const seen = new Set();
  const unique = [];
  for (const part of [title, metaDescription, ...headings, ...paragraphs]) {
    const key = part.toLowerCase();
    if (part && !seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }
  return unique.join('\n').slice(0, MAX_SITE_TEXT_CHARS);
}

/**
 * POST /api/brands/describe-from-site
 * Body: { website, brandName?, language? }
 * Returns: { description }
 *
 * Onboarding helper: drafts the "describe your brand" text from the brand's
 * own homepage so the user only reviews it. The description feeds every
 * later suggestion (topics, prompts, competitors), so a grounded draft
 * beats a blank textarea.
 */
router.post('/describe-from-site', async (req, res) => {
  try {
    const { website, brandName, language } = req.body;

    if (!website) {
      return res.status(400).json({ error: 'website is required' });
    }
    const url = normalizeWebsiteUrl(website);
    if (!url) {
      return res.status(400).json({ error: 'website is not a valid URL' });
    }

    let siteText;
    try {
      siteText = await fetchSiteText(url);
    } catch (err) {
      req.log.warn({ err, url }, 'describe-from-site: could not fetch site');
      return res.status(422).json({ error: 'site_unreachable' });
    }
    if (!siteText || siteText.length < 80) {
      return res.status(422).json({ error: 'site_empty' });
    }

    const langName = getLanguageName(language);
    const { text } = await withRetry(
      () =>
        generateText({
          model: resolveModel(),
          system: `You write short company descriptions. Given raw text extracted from a company's homepage, describe what the company does in 3-4 sentences: what it offers, the industry/category it operates in, and who its target audience is. Plain factual prose — no marketing superlatives, no bullet points, no headings. Write in ${langName}.`,
          prompt: `Company: ${brandName || 'unknown'}\nHomepage text:\n\n${siteText}`,
        }),
      { attempts: 2, baseDelayMs: 500, label: 'brand-describe' },
    );

    const description = text.trim();
    if (!description) {
      return res.status(422).json({ error: 'empty_summary' });
    }
    return res.json({ description });
  } catch (err) {
    req.log.error({ err }, 'describe-from-site error');
    return res.status(500).json({ error: 'Failed to generate description' });
  }
});

export default router;
