import { LegalArticle } from '@/components/marketing/legal-article';

// Public legal document — override the (marketing) group's noindex.
export const metadata = { robots: { index: true, follow: true } };

export default function PrivacyPolicyPage() {
  return <LegalArticle doc="privacy" />;
}
