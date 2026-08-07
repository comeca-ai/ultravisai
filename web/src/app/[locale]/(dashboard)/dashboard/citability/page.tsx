'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Citability Index (Índice de Citabilidade) — the prescriptive counterpart
 * to the Insights page: Insights is the scoreboard, this is the playbook.
 * Framework source of truth: `estrategia/indice-citabilidade.md`.
 *
 * Scoring is deliberately partial and honest: only dimensions the platform
 * already measures get a number (D1 from the latest Site Audit of the
 * primary domain, D2 from owned-citation coverage). Every unmeasured
 * dimension renders an explicit "not measured" state — never a bare 0 or
 * "—" that could be confused with a real bad score. The partial IC card
 * declares how much of the index is actually covered.
 *
 * The bubble matrix is a CONCEPTUAL diagram of the framework (positions are
 * fixed by the methodology, not driven by the brand's data), so it lives
 * inside a collapsible "how it works" section without chart framing.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronDown, Eye, FileText, Gauge } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandStore } from '@/stores/use-brand-store';
import { getAuditTrend, type AuditTrend } from '@/lib/actions/audits';
import { getCitationsOverview, type CitationsOverview } from '@/lib/actions/citations';
import { pct } from '@/components/audit/audit-report';
import { DomainFavicon } from '@/components/citations/source-cells';
import type { SourceCategory } from '@/lib/citations/classify';
import { cn } from '@/lib/utils';

// ─── Framework constants (mirror estrategia/indice-citabilidade.md) ─────────

type Zone = 'A' | 'B' | 'C';

const ZONE_COLORS: Record<Zone, string> = {
  A: '#2a78d6',
  B: '#eb6834',
  C: '#1baf7a',
};

type DimKey = 'dim1' | 'dim2' | 'dim3' | 'dim4' | 'dim5' | 'dim6';

interface Dimension {
  n: string;
  key: DimKey;
  weight: number;
  zone: Zone;
  /** Conceptual diagram position: x = internal↔external, y = dependency. */
  x: number;
  y: number;
  /** Citation source categories that feed this dimension's "answer key". */
  categories?: SourceCategory[];
  /** Where the card's CTA leads; undefined = destination doesn't exist yet. */
  ctaHref?: string;
}

const DIMENSIONS: Dimension[] = [
  { n: '01', key: 'dim1', weight: 15, zone: 'A', x: 12, y: 12, ctaHref: '/dashboard/audit' },
  { n: '02', key: 'dim2', weight: 20, zone: 'A', x: 22, y: 24, ctaHref: '/dashboard/content' },
  { n: '03', key: 'dim3', weight: 12, zone: 'B', x: 56, y: 30, categories: ['social'] },
  { n: '04', key: 'dim4', weight: 18, zone: 'B', x: 70, y: 48, categories: ['review', 'forum'] },
  {
    n: '05',
    key: 'dim5',
    weight: 22,
    zone: 'C',
    x: 84,
    y: 72,
    categories: ['editorial', 'other'],
    ctaHref: '/dashboard/citations',
  },
  { n: '06', key: 'dim6', weight: 13, zone: 'C', x: 92, y: 87, categories: ['institutional'] },
];

const ZONES: Zone[] = ['A', 'B', 'C'];

/** A dimension is either measured (score 0–100, zero included) or not. */
type DimStatus = { measured: true; score: number } | { measured: false };

/** Below this many citations, a category's answer key is directional only. */
const LOW_SAMPLE_THRESHOLD = 10;

// ─── Glossary term (dotted underline + native tooltip) ──────────────────────

function Term({ def, children }: { def: string; children: React.ReactNode }) {
  return (
    <span className="cursor-help underline decoration-dotted underline-offset-2" title={def}>
      {children}
    </span>
  );
}

// ─── Conceptual diagram (no chart framing — it is not data-driven) ──────────

function CitabilityDiagram({ dimLabel }: { dimLabel: (key: DimKey) => string }) {
  const t = useTranslations('citability');
  const W = 560;
  const H = 280;
  const M = { l: 40, r: 16, t: 12, b: 36 };
  const PW = W - M.l - M.r;
  const PH = H - M.t - M.b;
  const px = (x: number) => M.l + (x / 100) * PW;
  const py = (y: number) => M.t + (y / 100) * PH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('matrix.ariaLabel')}>
      {/* Directional captions only — no plot frame, this is a concept map */}
      <text
        x={M.l + PW / 2}
        y={H - 6}
        textAnchor="middle"
        className="fill-muted-foreground text-[11px]"
      >
        {t('matrix.xAxis')}
      </text>
      <text
        x={12}
        y={M.t + PH / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${M.t + PH / 2})`}
        className="fill-muted-foreground text-[11px]"
      >
        {t('matrix.yAxis')}
      </text>
      {DIMENSIONS.map((d) => (
        <g key={d.n}>
          <circle
            cx={px(d.x)}
            cy={py(d.y)}
            r={d.weight * 1.0}
            fill={ZONE_COLORS[d.zone]}
            fillOpacity={0.9}
            className="stroke-background"
            strokeWidth={2}
          >
            <title>{`${d.n} · ${dimLabel(d.key)} · ${d.weight}%`}</title>
          </circle>
          <text
            x={px(d.x)}
            y={py(d.y) + 4}
            textAnchor="middle"
            className="pointer-events-none fill-white text-[11px] font-semibold"
          >
            {d.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Not-measured label (shared visual for the empty state) ─────────────────

function NotMeasured({ className }: { className?: string }) {
  const t = useTranslations('citability');
  return (
    <span className={cn('font-medium italic text-muted-foreground', className)}>
      {t('notMeasured')}
    </span>
  );
}

// ─── Standardized dimension CTA ─────────────────────────────────────────────

function DimensionCta({ href, label }: { href?: string; label: string }) {
  const t = useTranslations('citability');
  if (!href) {
    return (
      <Button variant="outline" size="sm" className="w-full" disabled title={t('dims.comingSoon')}>
        {label} · {t('dims.comingSoon')}
      </Button>
    );
  }
  return (
    <Link href={href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}>
      {label}
      <ArrowRight className="ml-2 h-3.5 w-3.5" />
    </Link>
  );
}

// ─── Coverage bar: which dimensions already feed the partial IC ─────────────

function CoverageBar({ statuses }: { statuses: Record<DimKey, DimStatus> }) {
  const t = useTranslations('citability');
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={t('kpis.coverageBarAria')}
    >
      {DIMENSIONS.map((d) => (
        <div
          key={d.n}
          className={cn('h-full', !statuses[d.key].measured && 'bg-muted')}
          style={{
            width: `${d.weight}%`,
            backgroundColor: statuses[d.key].measured ? ZONE_COLORS[d.zone] : undefined,
          }}
          title={`${d.n} · ${d.weight}%${statuses[d.key].measured ? '' : ` · ${t('notMeasured')}`}`}
        />
      ))}
    </div>
  );
}

// ─── Answer-key table (favicon, clickable domain, citations, presence) ──────

interface AnswerKeyRow {
  domain: string;
  totalCitations: number;
}

function AnswerKeyTable({ rows, categoryTotal }: { rows: AnswerKeyRow[]; categoryTotal: number }) {
  const t = useTranslations('citability');
  return (
    <div className="rounded-md border bg-muted/30 p-2.5">
      <p className="mb-1.5 text-xs font-medium text-foreground">{t('dims.answerKey')}</p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.domain} className="border-t border-border/50 first:border-t-0">
              <td className="py-1.5 pr-2">
                <a
                  href={`https://${row.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 hover:underline"
                >
                  <span className="shrink-0 [&>*]:h-4 [&>*]:w-4">
                    <DomainFavicon domain={row.domain} />
                  </span>
                  <span className="truncate text-foreground">{row.domain}</span>
                </a>
              </td>
              <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                {t('dims.citationCount', { count: row.totalCitations })}
              </td>
              <td className="py-1.5 text-right">
                {/* The platform has no brand-presence data for third-party
                    domains yet — say so instead of guessing. */}
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                  {t('dims.presenceUnknown')}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {categoryTotal < LOW_SAMPLE_THRESHOLD && (
        <p className="mt-2 border-t border-border/50 pt-2 text-[11px] italic text-muted-foreground">
          {t('dims.lowSample', { count: categoryTotal })}
        </p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitabilityPage() {
  const t = useTranslations('citability');
  const activeBrandId = useBrandStore((s) => s.activeBrandId);
  const [auditTrend, setAuditTrend] = useState<AuditTrend | null>(null);
  const [overview, setOverview] = useState<CitationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [trendData, citationData] = await Promise.all([
          getAuditTrend(activeBrandId),
          getCitationsOverview(activeBrandId, { datePreset: 'all' }),
        ]);
        if (!cancelled) {
          setAuditTrend(trendData);
          setOverview(citationData);
        }
      } catch (err) {
        console.error('Failed to load citability data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  // D1 — latest Site Audit score for the brand's PRIMARY domain (0–100).
  // Same source as the Site Audit page's headline (getAuditTrend), so both
  // pages always show the same number. Not measured until an audit ran.
  const d1: DimStatus = useMemo(() => {
    const points = auditTrend?.points ?? [];
    for (let i = points.length - 1; i >= 0; i--) {
      const score = points[i].totalScore;
      if (score !== null) return { measured: true, score: pct(score) ?? 0 };
    }
    return { measured: false };
  }, [auditTrend]);

  // D2 — owned-citation coverage: share of tracked AI answers citing the
  // brand's own domain. Measured as soon as at least one tracking result
  // exists — a genuine 0 ("no AI answer cites you") is a real, meaningful
  // score, distinct from "never tracked".
  // resultsCiting is per-domain, so a result citing two owned subdomains
  // counts twice in the sum; Math.min caps the ratio at 100.
  const d2: DimStatus = useMemo(() => {
    if (!overview || overview.totals.results === 0) return { measured: false };
    const ownedResults = overview.rows
      .filter((r) => r.category === 'you')
      .reduce((sum, r) => sum + r.resultsCiting, 0);
    return {
      measured: true,
      score: Math.min(100, Math.round((ownedResults / overview.totals.results) * 100)),
    };
  }, [overview]);

  const statuses: Record<DimKey, DimStatus> = useMemo(
    () => ({
      dim1: d1,
      dim2: d2,
      dim3: { measured: false },
      dim4: { measured: false },
      dim5: { measured: false },
      dim6: { measured: false },
    }),
    [d1, d2],
  );

  // Coverage: how much of the index's total weight is actually measured.
  const coverage = useMemo(
    () => DIMENSIONS.reduce((sum, d) => sum + (statuses[d.key].measured ? d.weight : 0), 0),
    [statuses],
  );

  // Partial IC: weighted average over measured dimensions, weights
  // renormalized. Displayed attenuated while coverage is below 50%.
  const partialScore = useMemo(() => {
    const parts = DIMENSIONS.flatMap((d) => {
      const s = statuses[d.key];
      return s.measured ? [{ score: s.score, weight: d.weight }] : [];
    });
    if (parts.length === 0) return null;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    return Math.round(parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0));
  }, [statuses]);

  // "Answer key" per dimension: top cited domains in that dimension's
  // source categories, plus the category's citation total (for the
  // low-sample warning).
  const answerKey = useMemo(() => {
    const map = new Map<DimKey, { rows: AnswerKeyRow[]; categoryTotal: number }>();
    if (!overview) return map;
    for (const dim of DIMENSIONS) {
      if (!dim.categories) continue;
      const inCategory = overview.rows.filter((r) => dim.categories!.includes(r.category));
      const rows = [...inCategory]
        .sort((a, b) => b.totalCitations - a.totalCitations)
        .slice(0, 4)
        .map((r) => ({ domain: r.domain, totalCitations: r.totalCitations }));
      const categoryTotal = inCategory.reduce((sum, r) => sum + r.totalCitations, 0);
      map.set(dim.key, { rows, categoryTotal });
    }
    return map;
  }, [overview]);

  // Rich-text renderer for dimension descriptions: glossary terms get a
  // dotted underline + one-sentence tooltip. The tag map is shared — a
  // message that doesn't use a tag simply ignores it.
  const richDesc = (key: DimKey) =>
    t.rich(`dims.${key}.desc`, {
      geo: (chunks) => <Term def={t('glossary.geo')}>{chunks}</Term>,
      llms: (chunks) => <Term def={t('glossary.llms')}>{chunks}</Term>,
      wikidata: (chunks) => <Term def={t('glossary.wikidata')}>{chunks}</Term>,
      entity: (chunks) => <Term def={t('glossary.entity')}>{chunks}</Term>,
      ext: (chunks) => <Term def={t('glossary.extractable')}>{chunks}</Term>,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t('subtitle')}</p>
        </div>
        {/* Single mention of the data window, instead of repeating it per card */}
        <p className="text-xs text-muted-foreground">{t('windowNote')}</p>
      </div>

      {/* KPI row — the partial IC is the headline card (double width) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('kpis.icTitle')}
            </CardTitle>
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : partialScore === null ? (
              <div>
                <NotMeasured className="text-xl" />
                <p className="text-xs mt-1 text-muted-foreground">{t('kpis.icNoData')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  {/* Attenuated while coverage < 50%: the coverage line is the
                      headline, the score is the secondary figure. */}
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      coverage < 50 ? 'text-2xl text-muted-foreground' : 'text-4xl',
                    )}
                  >
                    {partialScore}
                    <span className="text-sm font-normal text-muted-foreground">/100</span>
                  </span>
                  <span className="text-base font-semibold">
                    {t('kpis.icCoverage', { coverage })}
                  </span>
                </div>
                <CoverageBar statuses={statuses} />
                <p className="text-xs text-muted-foreground">{t('kpis.icRecalc')}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* D1 KPI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('kpis.d1Title')}
            </CardTitle>
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : d1.measured ? (
              <div className="text-3xl font-bold tabular-nums">{d1.score}</div>
            ) : (
              <NotMeasured className="text-lg" />
            )}
            <p className="text-xs mt-1 text-muted-foreground">
              {d1.measured ? (
                t('kpis.d1Hint')
              ) : (
                <Link
                  href="/dashboard/audit"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t('dims.dim1.cta')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </p>
          </CardContent>
        </Card>

        {/* D2 KPI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('kpis.d2Title')}
            </CardTitle>
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : d2.measured ? (
              <div className="text-3xl font-bold tabular-nums">{d2.score}</div>
            ) : (
              <NotMeasured className="text-lg" />
            )}
            <p className="text-xs mt-1 text-muted-foreground">
              {!d2.measured ? (
                <Link
                  href="/dashboard/insights"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t('kpis.runTrackingCta')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : d2.score === 0 ? (
                t('kpis.d2Zero')
              ) : (
                t('kpis.d2Hint')
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How the IC works — collapsible, holds the conceptual diagram */}
      <Card>
        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          aria-expanded={showHow}
          className="flex w-full items-center justify-between rounded-xl px-6 py-4 text-left text-sm font-semibold transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('howItWorks')}
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', {
              'rotate-180': showHow,
            })}
          />
        </button>
        {showHow && (
          <CardContent className="pt-0">
            <p className="mb-3 text-xs text-muted-foreground">{t('matrix.subtitle')}</p>
            <div className="mx-auto max-w-xl">
              <CitabilityDiagram dimLabel={(key) => t(`dims.${key}.name`)} />
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {ZONES.map((zone) => (
                <span key={zone} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ZONE_COLORS[zone] }}
                  />
                  {t(`matrix.zone${zone}`)}
                </span>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Dimension cards, grouped by zone — the zone description lives here,
          once, instead of repeating in a separate action-plan block. */}
      {ZONES.map((zone) => (
        <section key={zone} className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: ZONE_COLORS[zone] }}
              />
              {t(`zones.${zone}.name`)}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(`zones.${zone}.desc`)}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {DIMENSIONS.filter((d) => d.zone === zone).map((dim) => {
              const status = statuses[dim.key];
              const key = answerKey.get(dim.key);
              return (
                <Card key={dim.n} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: ZONE_COLORS[dim.zone] }}
                      >
                        {dim.n} · {t(`zones.${dim.zone}.name`)}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t('dims.weight', { weight: dim.weight })}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm">{t(`dims.${dim.key}.name`)}</CardTitle>
                    <p className="text-xs font-medium text-primary">
                      {t(`dims.${dim.key}.action`)}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
                    <p>{richDesc(dim.key)}</p>
                    <div className="flex-1">
                      {loading ? (
                        <Skeleton className="h-8 w-full" />
                      ) : dim.categories ? (
                        key && key.rows.length > 0 ? (
                          <AnswerKeyTable rows={key.rows} categoryTotal={key.categoryTotal} />
                        ) : (
                          <p className="italic">{t('dims.noCitations')}</p>
                        )
                      ) : status.measured ? (
                        <div>
                          <span className="text-2xl font-bold tabular-nums text-foreground">
                            {status.score}
                          </span>
                          {dim.key === 'dim2' && status.score === 0 && (
                            <p className="mt-0.5">{t('kpis.d2Zero')}</p>
                          )}
                        </div>
                      ) : (
                        <NotMeasured />
                      )}
                    </div>
                    <DimensionCta href={dim.ctaHref} label={t(`dims.${dim.key}.cta`)} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
