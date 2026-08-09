import type { MetadataRoute } from 'next';

const BASE_URL = 'https://ultravis.ai';

/**
 * Public marketing pages (the landing at `/`) are crawlable — that's the whole
 * point of an AEO/GEO product: GPTBot, ClaudeBot, PerplexityBot and search
 * engines need to read us. The authenticated app, onboarding, auth flows,
 * invites and API endpoints are disallowed (they're also noindexed per
 * route-group layout).
 *
 * (Upstream blocked everything because its marketing site was a separate
 * Webflow app; ours lives in this Next.js app, so that default was wrong.)
 */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    '/dashboard',
    '/onboarding',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
    '/auth',
    '/invite',
    '/api',
  ];
  // Cover both the default (pt-BR, unprefixed) and the `en` locale.
  const disallow = privatePaths.flatMap((p) => [p, `/en${p}`]);

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
