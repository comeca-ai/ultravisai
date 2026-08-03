export const siteConfig = {
  name: 'Ultravis',
  description:
    "Monitor, analyze, and optimize your brand's visibility in AI-powered search engines like ChatGPT, Perplexity, Gemini, and more.",
  url: 'https://ultravis.ai',
  ogImage: 'https://app.ultravis.ai/opengraph-image',
  links: {
    github: 'https://github.com/ansvisor/ansvisor',
    docs: 'https://docs.ultravis.ai',
  },
  legal: {
    privacy: 'https://www.ultravis.ai/privacy-policy',
    terms: 'https://www.ultravis.ai/terms-of-service',
  },
} as const;

export type SiteConfig = typeof siteConfig;
