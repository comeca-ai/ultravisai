export const siteConfig = {
  name: 'Ultravis',
  tagline: 'Vision beyond reach',
  description:
    "Monitor, analyze, and optimize your brand's visibility in AI-powered search engines like ChatGPT, Perplexity, Gemini, and more.",
  url: 'https://ultravis.ai',
  ogImage: 'https://app.ultravis.ai/opengraph-image',
  links: {
    docs: 'https://docs.ultravis.ai',
  },
  legal: {
    privacy: '/privacy-policy',
    terms: '/terms-of-service',
  },
} as const;

export type SiteConfig = typeof siteConfig;
