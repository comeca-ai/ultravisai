import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.ultravis.ai'),
  title: {
    default: 'Ultravis',
    template: '%s | Ultravis',
  },
  description:
    "Monitor, analyze, and optimize your brand's visibility in AI-powered search engines.",
  openGraph: {
    title: 'Ultravis',
    description:
      'Track how AI search engines mention your brand — ChatGPT, Gemini, Perplexity, Claude, Copilot.',
    url: '/',
    siteName: 'Ultravis',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ultravis',
    description:
      'Track how AI search engines mention your brand — ChatGPT, Gemini, Perplexity, Claude, Copilot.',
  },
  // The product app at app.ultravis.ai should not appear in search results;
  // ultravis.ai (the Webflow marketing site) is the indexable surface.
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jakarta.variable}`}
    >
      <body suppressHydrationWarning className="font-sans antialiased">
        <PostHogProvider />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
