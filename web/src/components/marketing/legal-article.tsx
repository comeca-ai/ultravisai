import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Ultravis addition (fork layer). Shared renderer for the legal pages
 * (Terms of Service / Privacy Policy). Content lives entirely in the
 * `legal` i18n namespace; the texts are a deliberately generic preliminary
 * version (no legal-entity names) until the internally approved wording
 * lands — the visible draft notice states that.
 */
export function LegalArticle({ doc }: { doc: 'terms' | 'privacy' }) {
  const t = useTranslations('legal');
  const sections = t.raw(`${doc}.sections`) as { h: string; p: string[] }[];

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{t(`${doc}.title`)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('updated')}</p>
      <p className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        {t('draftNotice')}
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.h}>
            <h2 className="text-lg font-semibold">{section.h}</h2>
            {section.p.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6 text-sm">
        <a href={`mailto:${t('contactEmail')}`} className="text-primary hover:underline">
          {t('contactEmail')}
        </a>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          {t('backHome')}
        </Link>
      </div>
    </article>
  );
}
