'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'PT',
  en: 'EN',
};

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5',
        className,
      )}
      role="group"
      aria-label={t('language')}
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === locale ? 'true' : undefined}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
            l === locale
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {LOCALE_LABELS[l]}
        </Link>
      ))}
    </div>
  );
}
