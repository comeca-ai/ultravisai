import type { MetadataRoute } from 'next';

const BASE_URL = 'https://ultravis.ai';

/**
 * Public, indexable pages only. The default locale (pt-BR) is unprefixed; `en`
 * is prefixed. Add pricing / features / legal pages here as they ship.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/en`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
  ];
}
