import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { siteConfig } from '@/config/site';

export function MarketingFooter() {
  const t = useTranslations('landing.footer');
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {siteConfig.name}. {t('rights')}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href={siteConfig.legal.terms} className="hover:text-foreground transition-colors">
            {t('terms')}
          </Link>
          <Link href={siteConfig.legal.privacy} className="hover:text-foreground transition-colors">
            {t('privacy')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
