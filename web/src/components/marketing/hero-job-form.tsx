'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'ultravis_job_site';

function normalizeSite(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

export function HeroJobForm() {
  const t = useTranslations('landing.hero');
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const site = normalizeSite(value);
    if (!site) {
      setError(t('formError'));
      return;
    }
    setError('');
    try {
      window.sessionStorage.setItem(STORAGE_KEY, site);
    } catch {
      /* ignore */
    }
    router.push(`/sign-up?site=${encodeURIComponent(site)}`);
  }

  return (
    <form
      id="busca"
      onSubmit={handleSubmit}
      className="mt-1.5 flex w-full max-w-[560px] flex-col items-stretch gap-2 text-left"
    >
      <label htmlFor="job-site" className="sr-only">
        {t('formPlaceholder')}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="job-site"
          name="site"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={t('formPlaceholder')}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError('');
          }}
          className="h-12 flex-1 rounded-[10px] border border-[#CFC9BC] bg-white px-4 text-base text-[#0B0D10] outline-none placeholder:text-[#8A867E] focus:border-[#0B0D10]"
        />
        <button
          type="submit"
          className="h-12 rounded-[10px] bg-[#D8452F] px-6 text-base font-bold text-[#FFF6F2] transition-colors hover:bg-[#0B0D10] hover:text-[#F4F2ED] sm:min-w-[200px]"
        >
          {t('ctaPrimary')}
        </button>
      </div>
      {error ? (
        <p className="text-[13px] text-[#D8452F]">{error}</p>
      ) : (
        <p className="text-[13px] text-[#8A867E]">{t('formHint')}</p>
      )}
      <p className="text-center text-[13.5px] text-[#6C6A64]">
        <Link href="/sign-in" className="font-semibold underline-offset-4 hover:underline">
          {t('ctaSecondary')}
        </Link>
      </p>
    </form>
  );
}
