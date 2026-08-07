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
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Eye, FileText, Gauge } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandStore } from '@/stores/use-brand-store';
import { getAuditTrend, type AuditTrend } from '@/lib/actions/audits';
import { getCitationsOverview, type CitationsOverview } from '@/lib/actions/citations';
import { pct } from '@/components/audit/audit-report';
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
  /** Matrix position: x = internal↔external, y = third-party dependency. */
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

// ─── Matrix (SVG) ────────────────────────────────────────────────────────────

function CitabilityMatrix({ dimLabel }: { dimLabel: (key: DimKey) => string }) {
  const t = useTranslations('citability');
  const W = 640;
  const H = 340;
  const M = { l: 48, r: 20, t: 20, b: 44 };
  const PW = W - M.l - M.r;
  const PH = H - M.t - M.b;
  const px = (x: number) => M.l + (x / 100) * PW;
  const py = (y: number) => M.t + (y / 100) * PH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('matrix.ariaLabel')}>
      <rect
        x={M.l}
        y={M.t}
        width={PW}
        height={PH}
        rx={8}
        className="fill-muted/30 stroke-border"
        strokeWidth={1}
      />
      <text x={M.l + 12} y={M.t + PH - 14} className="fill-muted-foreground/60 text-[10px] italic">
        {t('matrix.emptyZone')}
      </text>
      {/* Axes labels */}
      <text
        x={M.l + PW / 2}
        y={H - 10}
        textAnchor="middle"
        className="fill-muted-foreground text-[11px]"
      >
        {t('matrix.xAxis')}
      </text>
      <text
        x={14}
        y={M.t + PH / 2}
        textAnchor="middle"
        transform={`rotate(-90 14 ${M.t + PH / 2})`}
        className="fill-muted-foreground text-[11px]"
      >
        {t('matrix.yAxis')}
      </text>
      {/* Bubbles: radius encodes IC weight */}
      {DIMENSIONS.map((d) => (
        <g key={d.n}>
          <circle
            cx={px(d.x)}
            cy={py(d.y)}
            r={d.weight * 1.1}
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitabilityPage() {
  const t = useTranslations('citability');
  const activeBrandId = useBrandStore((s) => s.activeBrandId);
  const [auditTrend, setAuditTrend] = useState<AuditTrend | null>(null);
  const [overview, setOverview] = useState<CitationsOverview | null>(null);
  const [loading, setLoading] = useState(true);

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
  // source categories — the real list of sources AI engines cite for this
  // brand's prompts.
  const answerKey = useMemo(() => {
    const map = new Map<DimKey, { domain: string; totalCitations: number }[]>();
    if (!overview) return map;
    for (const dim of DIMENSIONS) {
      if (!dim.categories) continue;
      const rows = overview.rows
        .filter((r) => dim.categories!.includes(r.category))
        .sort((a, b) => b.totalCitations - a.totalCitations)
        .slice(0, 4)
        .map((r) => ({ domain: r.domain, totalCitations: r.totalCitations }));
      map.set(dim.key, rows);
    }
    return map;
  }, [overview]);

  const ctaLabel = (key: DimKey) => t(`dims.${key}.cta`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t('subtitle')}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Partial IC — declares its own coverage instead of posing as a full score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('kpis.icTitle')}
            </CardTitle>
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : partialScore === null ? (
              <div>
                <NotMeasured className="text-lg" />
                <p className="text-xs mt-1 text-muted-foreground">{t('kpis.icNoData')}</p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  {/* Attenuated while coverage < 50%: the coverage line is the
                      headline, the score is the secondary figure. */}
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      coverage < 50 ? 'text-xl text-muted-foreground' : 'text-3xl',
                    )}
                  >
                    {partialScore}
                    <span className="text-xs font-normal text-muted-foreground">/100</span>
                  </span>
                  <span className="text-sm font-semibold">
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

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('matrix.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('matrix.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="mx-auto max-w-3xl">
            <CitabilityMatrix dimLabel={(key) => t(`dims.${key}.name`)} />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
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
              const domains = answerKey.get(dim.key) ?? [];
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
                    <p>{t(`dims.${dim.key}.desc`)}</p>
                    <div className="flex-1">
                      {loading ? (
                        <Skeleton className="h-8 w-full" />
                      ) : dim.categories ? (
                        domains.length > 0 ? (
                          <div className="rounded-md border bg-muted/30 p-2.5">
                            <p className="mb-1.5 font-medium text-foreground">
                              {t('dims.answerKey')}
                            </p>
                            <ul className="space-y-1">
                              {domains.map((row) => (
                                <li key={row.domain} className="flex justify-between gap-2">
                                  <span className="truncate">{row.domain}</span>
                                  <span className="shrink-0 tabular-nums">
                                    {t('dims.citationCount', { count: row.totalCitations })}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
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
                    <DimensionCta href={dim.ctaHref} label={ctaLabel(dim.key)} />
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
