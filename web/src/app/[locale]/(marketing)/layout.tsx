import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

// Auth pages (sign-in/up, password reset) live in this group — noindex them.
// The public landing is NOT in this group, so it stays indexable.
export const metadata = { robots: { index: false, follow: false } };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
