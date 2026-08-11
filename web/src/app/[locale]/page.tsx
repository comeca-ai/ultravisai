import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/marketing/locale-switcher';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  return { title: t('title'), description: t('description') };
}

interface TickerItem {
  src: string;
  q: string;
}
interface BarItem {
  label: string;
  value: string;
}
interface PromptItem {
  rank: string;
  text: string;
  delta: string;
  up: boolean;
}
interface StatItem {
  num: string;
  title: string;
  body: string;
}
interface FeatureItem {
  num: string;
  title: string;
  body: string;
  tags: string[];
}
interface BlindItem {
  label: string;
  title: string;
  body: string;
}
interface FanoutItem {
  n: string;
  q: string;
  state: string;
  cited: boolean;
}
interface TeamItem {
  title: string;
  body: string;
}
interface PlanItem {
  name: string;
  tag: string;
  price: string;
  per: string;
  body: string;
  items: string[];
  cta: string;
  featured: boolean;
}
interface FaqItem {
  q: string;
  a: string;
}
function UltravisMark({
  size,
  stroke,
  pupil,
  withReachDot = false,
}: {
  size: number;
  stroke: string;
  pupil: string;
  withReachDot?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-label="Ultravis">
      <path d="M47 21 C21 41 21 79 47 99" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
      <path d="M73 21 C99 41 99 79 73 99" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
      <circle cx="60" cy="60" r="13" fill={pupil} />
      {withReachDot && (
        <circle
          cx="103"
          cy="17"
          r="6.5"
          fill="#D8452F"
          style={{ animation: 'uv-pulse 2.4s ease-in-out infinite' }}
        />
      )}
    </svg>
  );
}

export default function LandingPage() {
  const t = useTranslations('landing');

  const ticker = t.raw('hero.ticker') as TickerItem[];
  const bars = t.raw('platform.bars') as BarItem[];
  const prompts = t.raw('platform.prompts') as PromptItem[];
  const engines = t.raw('platform.engines') as string[];
  const stats = t.raw('market.stats') as StatItem[];
  const features = t.raw('features.items') as FeatureItem[];
  const blind = t.raw('beyond.blind') as BlindItem[];
  const fanout = t.raw('beyond.fanout') as FanoutItem[];
  const teams = t.raw('teams.items') as TeamItem[];
  const plans = t.raw('pricing.plans') as PlanItem[];
  const faq = t.raw('faq.items') as FaqItem[];

  const barWidths = [71, 64, 58, 49, 31];

  return (
    <div className="bg-[#F4F2ED] text-[#0B0D10] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E2DED5] bg-[#F4F2ED]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center gap-6 px-6 py-3.5 lg:gap-10 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <UltravisMark size={26} stroke="#0B0D10" pupil="#D8452F" />
            <span className="text-lg font-extrabold tracking-tight uppercase">Ultravis</span>
          </a>
          <nav className="hidden items-center gap-6 text-[14.5px] font-medium text-[#3B3934] md:flex">
            <a href="#platform" className="hover:text-[#D8452F]">
              {t('nav.platform')}
            </a>
            <a href="#solutions" className="hover:text-[#D8452F]">
              {t('nav.solutions')}
            </a>
            <a href="#market" className="hover:text-[#D8452F]">
              {t('nav.market')}
            </a>
            <a href="#pricing" className="hover:text-[#D8452F]">
              {t('nav.pricing')}
            </a>
            <a href="#faq" className="hover:text-[#D8452F]">
              {t('nav.faq')}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <LocaleSwitcher />
            <Link
              href="/sign-in"
              className="hidden rounded-lg px-4 py-2.5 text-[14.5px] font-semibold hover:bg-[#EAE6DE] sm:block"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              href="/sign-up"
              className="rounded-[9px] bg-[#D8452F] px-5 py-2.5 text-[14.5px] font-bold text-[#FFF6F2] transition-colors hover:bg-[#0B0D10] hover:text-[#F4F2ED]"
            >
              {t('nav.createAccount')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden border-b border-[#E2DED5]">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center gap-6 px-6 pt-20 pb-20 text-center lg:px-8 lg:pt-24">
          <UltravisMark size={72} stroke="#0B0D10" pupil="#D8452F" withReachDot />
          <div className="rounded-full border border-[#DFDACF] bg-[#EFECE4] px-4 py-1.5 font-mono text-[12.5px] tracking-wide text-[#6C6A64]">
            {t('hero.badge')}
          </div>
          <h1 className="max-w-[1040px] text-[44px] leading-[0.98] font-black tracking-[-0.045em] text-balance sm:text-[64px] lg:text-[84px] lg:leading-[0.95]">
            {t('hero.titleStart')}
            <span className="text-[#D8452F]">{t('hero.titleHighlight')}</span>
          </h1>
          <p className="max-w-[680px] text-[17px] leading-relaxed text-[#4A4842] text-pretty lg:text-[19.5px]">
            {t('hero.subtitle')}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-[10px] bg-[#D8452F] px-7 py-4 text-base font-bold text-[#FFF6F2] transition-colors hover:bg-[#0B0D10] hover:text-[#F4F2ED]"
            >
              {t('hero.ctaPrimary')}
            </Link>
            <Link
              href="/sign-in"
              className="rounded-[10px] border border-[#CFC9BC] bg-white px-7 py-4 text-base font-semibold transition-colors hover:border-[#0B0D10]"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <div className="text-[13.5px] text-[#8A867E]">{t('hero.ctaNote')}</div>

          {/* Ticker */}
          <div className="mt-6 flex w-full max-w-[980px] flex-col gap-3.5">
            <div className="font-mono text-[11.5px] tracking-[0.14em] text-[#A8A398] uppercase">
              {t('hero.tickerLabel')}
            </div>
            <div
              className="overflow-hidden"
              style={{
                maskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
                WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)',
              }}
            >
              <div
                className="flex w-max gap-3"
                style={{ animation: 'uv-drift 42s linear infinite' }}
              >
                {[...ticker, ...ticker].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-full border border-[#DFDACF] bg-white px-4 py-2 text-sm whitespace-nowrap text-[#4A4842]"
                  >
                    <span className="font-mono text-[11px] text-[#A8A398]">{item.src}</span>
                    <span>{item.q}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform mock */}
      <section id="platform" className="mx-auto max-w-[1240px] px-6 py-20 lg:px-8">
        <div className="flex flex-col gap-5 rounded-[22px] bg-[#0B0D10] p-5 lg:p-7">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2B2E33]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2B2E33]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2B2E33]" />
            </div>
            <div className="font-mono text-xs text-[#6E7278]">{t('platform.browserPath')}</div>
            <div className="ml-auto flex items-center gap-2 font-mono text-[11.5px] text-[#8E9298]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#D8452F]"
                style={{ animation: 'uv-pulse 2s ease-in-out infinite' }}
              />
              {t('platform.live')}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-5 rounded-[14px] border border-[#23262B] bg-[#14171B] p-6">
              <div className="flex items-baseline justify-between">
                <div className="text-[12.5px] tracking-[0.12em] text-[#7E838A] uppercase">
                  {t('platform.scoreLabel')}
                </div>
                <div className="font-mono text-xs text-[#D8452F]">{t('platform.scoreDelta')}</div>
              </div>
              <div className="flex items-baseline gap-3">
                <div className="text-[56px] leading-none font-black tracking-[-0.045em] text-[#F4F2ED] lg:text-[68px]">
                  {t('platform.scoreValue')}
                </div>
                <div className="text-[15px] text-[#7E838A]">{t('platform.scoreOf')}</div>
              </div>
              <div className="flex flex-col gap-3.5">
                {bars.map((bar, i) => (
                  <div key={bar.label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13.5px] text-[#B9BCC1]">
                      <span>{bar.label}</span>
                      <span className="font-mono text-[#F4F2ED]">{bar.value}</span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-[#23262B]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barWidths[i] ?? 50}%`,
                          background: i < 2 ? '#D8452F' : i < 4 ? '#F4F2ED' : '#4A4E55',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex flex-1 flex-col gap-3 rounded-[14px] border border-[#23262B] bg-[#14171B] p-6">
                <div className="text-[12.5px] tracking-[0.12em] text-[#7E838A] uppercase">
                  {t('platform.promptsLabel')}
                </div>
                {prompts.map((p) => (
                  <div
                    key={p.rank}
                    className="flex items-center gap-3 border-t border-[#1E2126] py-2.5"
                  >
                    <span className="flex-none font-mono text-xs text-[#5F646B]">{p.rank}</span>
                    <span className="flex-1 text-sm leading-snug text-[#D9DBDE]">{p.text}</span>
                    <span
                      className="flex-none font-mono text-xs"
                      style={{ color: p.up ? '#D8452F' : '#6E7278' }}
                    >
                      {p.delta}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 rounded-[14px] bg-[#D8452F] px-6 py-5">
                <div className="text-[12.5px] tracking-[0.12em] text-[#FFF6F2]/70 uppercase">
                  {t('platform.citationsLabel')}
                </div>
                <div className="text-[40px] leading-none font-black tracking-[-0.035em] text-[#FFF6F2]">
                  {t('platform.citationsValue')}
                </div>
                <div className="text-[13.5px] text-[#FFF6F2]/80">{t('platform.citationsNote')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 pt-11 text-sm font-semibold text-[#8A867E]">
          <span className="font-mono text-[11.5px] tracking-[0.14em] text-[#A8A398] uppercase">
            {t('platform.coverageLabel')}
          </span>
          {engines.map((engine) => (
            <span key={engine} className="text-[#4A4842]">
              {engine}
            </span>
          ))}
        </div>
      </section>

      {/* Market */}
      <section id="market" className="border-y border-[#E2DED5] bg-[#EFECE4]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-11 px-6 py-20 lg:px-8">
          <div className="flex max-w-[760px] flex-col gap-3.5">
            <div className="font-mono text-[12.5px] tracking-wide text-[#D8452F]">
              {t('market.kicker')}
            </div>
            <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance lg:text-[48px] lg:leading-[1.02]">
              {t('market.title')}
            </h2>
            <p className="text-[16px] leading-relaxed text-[#4A4842] text-pretty lg:text-[17.5px]">
              {t('market.subtitle')}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.num}
                className="flex flex-col gap-3 rounded-2xl border border-[#DFDACF] bg-[#F4F2ED] p-7"
              >
                <div className="text-[52px] leading-none font-black tracking-[-0.045em] text-[#D8452F] lg:text-[62px]">
                  {s.num}
                </div>
                <div className="text-[17px] font-bold tracking-tight">{s.title}</div>
                <div className="text-[14.5px] leading-normal text-[#5B5851] text-pretty">
                  {s.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="solutions"
        className="mx-auto flex max-w-[1240px] flex-col gap-11 px-6 py-[92px] lg:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div className="flex max-w-[640px] flex-col gap-3.5">
            <div className="font-mono text-[12.5px] tracking-wide text-[#D8452F]">
              {t('features.kicker')}
            </div>
            <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance lg:text-[48px] lg:leading-[1.02]">
              {t('features.title')}
            </h2>
          </div>
          <p className="max-w-[380px] text-base leading-relaxed text-[#5B5851] text-pretty">
            {t('features.subtitle')}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.num}
              className="flex flex-col gap-3 rounded-2xl border border-[#DCD8D0] bg-white p-8 transition-colors hover:border-[#D8452F]"
            >
              <div className="font-mono text-xs text-[#D8452F]">{f.num}</div>
              <div className="text-[23px] font-extrabold tracking-tight">{f.title}</div>
              <div className="text-[15.5px] leading-relaxed text-[#5B5851] text-pretty">
                {f.body}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {f.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-[#E2DED5] bg-[#F7F5F0] px-2 py-1 font-mono text-[11.5px] text-[#6C6A64]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Beyond reach (dark) */}
      <section className="bg-[#0B0D10] text-[#F4F2ED]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 py-[92px] lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-10">
            <div className="flex max-w-[660px] flex-col gap-3.5">
              <div className="font-mono text-[12.5px] tracking-wide text-[#D8452F]">
                {t('beyond.kicker')}
              </div>
              <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance lg:text-[48px] lg:leading-[1.02]">
                {t('beyond.title')}
              </h2>
            </div>
            <p className="max-w-[380px] text-base leading-relaxed text-[#A8ACB2] text-pretty">
              {t('beyond.subtitle')}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {blind.map((b) => (
              <div
                key={b.label}
                className="flex flex-col gap-3.5 rounded-2xl border border-[#23262B] bg-[#14171B] p-7"
              >
                <div className="text-[12.5px] tracking-[0.12em] text-[#7E838A] uppercase">
                  {b.label}
                </div>
                <div className="text-[21px] leading-tight font-bold tracking-tight text-pretty">
                  {b.title}
                </div>
                <div className="text-[14.5px] leading-relaxed text-[#8E9298] text-pretty">
                  {b.body}
                </div>
              </div>
            ))}
          </div>

          <div className="grid items-center gap-9 rounded-[18px] border border-[#23262B] bg-[#14171B] p-6 lg:grid-cols-2 lg:p-9">
            <div className="flex flex-col gap-3.5">
              <div className="text-[12.5px] tracking-[0.12em] text-[#7E838A] uppercase">
                {t('beyond.fanoutLabel')}
              </div>
              <div className="text-[22px] leading-tight font-extrabold tracking-tight text-pretty lg:text-[26px]">
                {t('beyond.fanoutTitle')}
              </div>
              <div className="text-[15px] leading-relaxed text-[#8E9298] text-pretty">
                {t('beyond.fanoutBody')}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {fanout.map((fo) => (
                <div
                  key={fo.n}
                  className="flex items-center gap-3 rounded-[9px] border border-[#23262B] bg-[#0B0D10] px-3.5 py-3"
                >
                  <span className="font-mono text-[11px] text-[#5F646B]">{fo.n}</span>
                  <span className="flex-1 text-sm text-[#D9DBDE]">{fo.q}</span>
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: fo.cited ? '#D8452F' : '#6E7278' }}
                  >
                    {fo.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Teams */}
      <section className="mx-auto flex max-w-[1240px] flex-col gap-11 px-6 py-[92px] lg:px-8">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="font-mono text-[12.5px] tracking-wide text-[#D8452F]">
            {t('teams.kicker')}
          </div>
          <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance lg:text-[48px] lg:leading-[1.02]">
            {t('teams.title')}
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((team) => (
            <div
              key={team.title}
              className="flex flex-col gap-2.5 rounded-[14px] border border-[#DCD8D0] bg-white p-6 transition-colors hover:border-[#D8452F]"
            >
              <div className="text-[17px] font-extrabold tracking-tight">{team.title}</div>
              <div className="text-[14.5px] leading-normal text-[#5B5851] text-pretty">
                {team.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[#E2DED5] bg-[#EFECE4]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-11 px-6 py-[92px] lg:px-8">
          <div className="flex max-w-[680px] flex-col gap-3.5">
            <div className="font-mono text-[12.5px] tracking-wide text-[#D8452F]">
              {t('pricing.kicker')}
            </div>
            <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance lg:text-[48px] lg:leading-[1.02]">
              {t('pricing.title')}
            </h2>
          </div>
          <div className="grid items-start gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={
                  plan.featured
                    ? 'flex flex-col gap-4 rounded-[18px] border border-[#0B0D10] bg-[#0B0D10] p-8 text-[#F4F2ED]'
                    : 'flex flex-col gap-4 rounded-[18px] border border-[#DFDACF] bg-[#F4F2ED] p-8 text-[#0B0D10]'
                }
              >
                <div className="flex items-center justify-between">
                  <div className="text-[17px] font-extrabold tracking-tight">{plan.name}</div>
                  <span
                    className={
                      plan.featured
                        ? 'rounded-md bg-[#D8452F] px-2 py-1 font-mono text-[11px] text-[#FFF6F2]'
                        : 'rounded-md bg-[#EAE6DE] px-2 py-1 font-mono text-[11px] text-[#6C6A64]'
                    }
                  >
                    {plan.tag}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[44px] leading-none font-black tracking-[-0.04em]">
                    {plan.price}
                  </span>
                  <span className="text-sm opacity-60">{plan.per}</span>
                </div>
                <div className="text-[14.5px] leading-normal opacity-75 text-pretty">
                  {plan.body}
                </div>
                <div className="flex flex-col gap-2 pt-1.5">
                  {plan.items.map((item) => (
                    <div key={item} className="flex gap-2.5 text-[14.5px] leading-snug">
                      <span className="font-bold text-[#D8452F]">✓</span>
                      <span className="opacity-85">{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/sign-up"
                  className={
                    plan.featured
                      ? 'mt-auto rounded-[10px] bg-[#D8452F] p-3.5 text-center text-[15px] font-bold text-[#FFF6F2] transition-opacity hover:opacity-90'
                      : 'mt-auto rounded-[10px] bg-[#0B0D10] p-3.5 text-center text-[15px] font-bold text-[#F4F2ED] transition-opacity hover:opacity-90'
                  }
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="mx-auto flex max-w-[900px] flex-col gap-8 px-6 py-[92px] lg:px-8"
      >
        <h2 className="text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] lg:text-[44px] lg:leading-[1.02]">
          {t('faq.title')}
        </h2>
        <div className="flex flex-col">
          {faq.map((item) => (
            <div key={item.q} className="flex flex-col gap-2.5 border-t border-[#DFDACF] py-6">
              <div className="text-[19px] font-bold tracking-tight">{item.q}</div>
              <div className="text-base leading-relaxed text-[#5B5851] text-pretty">{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1240px] px-6 pb-[92px] lg:px-8">
        <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[22px] bg-[#D8452F] px-8 py-16 text-center lg:px-12 lg:py-20">
          <svg width="54" height="54" viewBox="0 0 120 120" fill="none" aria-label="Ultravis">
            <path
              d="M47 21 C21 41 21 79 47 99"
              stroke="#FFF6F2"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M73 21 C99 41 99 79 73 99"
              stroke="#FFF6F2"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <circle cx="60" cy="60" r="12" fill="#0B0D10" />
          </svg>
          <h2 className="max-w-[800px] text-[36px] leading-none font-black tracking-[-0.045em] text-balance text-[#FFF6F2] lg:text-[56px]">
            {t('cta.title')}
          </h2>
          <p className="max-w-[520px] text-[16px] leading-normal text-[#FFF6F2]/90 text-pretty lg:text-lg">
            {t('cta.subtitle')}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-[10px] bg-[#0B0D10] px-8 py-4 text-base font-bold text-[#F4F2ED] transition-colors hover:bg-[#FFF6F2] hover:text-[#0B0D10]"
            >
              {t('cta.primary')}
            </Link>
            <Link
              href="/sign-in"
              className="rounded-[10px] border border-[#FFF6F2]/50 px-8 py-4 text-base font-semibold text-[#FFF6F2] transition-colors hover:bg-[#FFF6F2]/10"
            >
              {t('cta.secondary')}
            </Link>
          </div>
          <div className="text-[13.5px] text-[#FFF6F2]/70">{t('cta.note')}</div>
        </div>
      </section>

      {/* Footer — link columns removed on purpose (they pointed nowhere;
          QA + client feedback). Bring sections back only as their pages
          actually exist. */}
      <footer className="border-t border-[#E2DED5]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 px-6 pt-14 pb-10 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo_light.svg"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 shrink-0"
            />
            <span className="text-[17px] font-extrabold tracking-tight uppercase">Ultravis</span>
          </div>
          <div className="max-w-[280px] text-[14.5px] leading-normal text-[#5B5851] text-pretty">
            {t('footer.tagline')}
          </div>
        </div>
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-5 border-t border-[#E2DED5] px-6 pt-5 pb-11 text-[13px] text-[#8A867E] lg:px-8">
          <span>
            © {new Date().getFullYear()} Ultravis. {t('footer.rights')}
          </span>
          <span className="flex gap-5">
            <Link href="/terms-of-service" className="hover:text-[#0B0D10]">
              {t('footer.terms')}
            </Link>
            <Link href="/privacy-policy" className="hover:text-[#0B0D10]">
              {t('footer.privacy')}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
