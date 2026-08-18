'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Índice de Visibilidade v2 — implements the template approved 15/ago
 * (meeting of 14/ago): every dimension scored, the math always open and
 * reconciling, a plain-language explanation and the researched sources
 * ALWAYS visible on every card, and the old "visibility" demoted to
 * "share de resposta nos prompts" with an explicit reconciliation line.
 *
 * Scoring rules v1 (weights in `web/src/config/visibility-index.ts`,
 * framework in `estrategia/indice-citabilidade.md`):
 * - D1  ← latest Site Audit of the primary domain (same as Auditoria page).
 * - D2  ← own-citation share normalized (10% ⇒ 100; real best case 7.4%).
 * - D3–D6 ← relative to the sector gabarito: among answers citing that
 *   category's sources, share where the brand is present. Low samples are
 *   scored anyway and flagged "direcional" (owner decision, 15/ago).
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandStore } from '@/stores/use-brand-store';
import { getAuditTrend, type AuditTrend } from '@/lib/actions/audits';
import {
  getVisibilityIndex,
  type IndexCategoryData,
  type VisibilityIndexData,
  type VisibilityIndexPreset,
} from '@/lib/actions/visibility-index';
import { pct } from '@/components/audit/audit-report';
import { DomainFavicon } from '@/components/citations/source-cells';
import { PLATFORM_LABELS } from '@/config/platform-labels';
import {
  INDEX_DIMENSIONS,
  INDEX_LOW_SAMPLE_THRESHOLD,
  INDEX_SCORE_BANDS,
  INDEX_ZONE_COLORS,
  INDEX_ZONES,
  indexScoreBand,
  type IndexDimKey,
} from '@/config/visibility-index';
import { cn } from '@/lib/utils';

// ─── Score semantics ─────────────────────────────────────────────────────────

function scoreColorClass(score: number): string {
  if (score >= 50) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBarClass(score: number): string {
  if (score >= 50) return 'bg-emerald-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-red-500';
}

const BAND_CLASSES: Record<string, string> = {
  undesirable: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  regular: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  good: 'border-lime-600/30 bg-lime-500/10 text-lime-700 dark:text-lime-400',
  great: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  best: 'border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300',
};

const CATEGORY_BY_DIM: Partial<Record<IndexDimKey, keyof VisibilityIndexData['categories']>> = {
  dim3: 'social',
  dim4: 'reviews',
  dim5: 'media',
  dim6: 'verticals',
};

// ─── Small pieces ────────────────────────────────────────────────────────────

function SourceChip({
  domain,
  youAppear,
  appearLabel,
  absentLabel,
}: {
  domain: string;
  youAppear: boolean;
  appearLabel: string;
  absentLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px]">
      <span className="shrink-0 [&>*]:h-3.5 [&>*]:w-3.5">
        <DomainFavicon domain={domain} />
      </span>
      <span className="max-w-[150px] truncate">{domain}</span>
      {youAppear ? (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">✓</span>
      ) : (
        <span
          className="font-medium text-red-600 dark:text-red-400"
          title={absentLabel}
          aria-label={`${domain}: ${absentLabel}`}
        >
          ✗
        </span>
      )}
      <span className="sr-only">{youAppear ? appearLabel : absentLabel}</span>
    </span>
  );
}

function EvolutionSparkline({
  points,
  ariaLabel,
}: {
  points: Array<{ weekStart: string; index: number }>;
  ariaLabel: string;
}) {
  const W = 320;
  const H = 90;
  const PAD = 14;
  if (points.length === 0) return null;
  const xs = points.map((_, i) =>
    points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1),
  );
  const ys = points.map((p) => H - PAD - (p.index / 100) * (H - PAD * 2));
  const line = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-border" />
      <polyline points={line} fill="none" stroke="#D8452F" strokeWidth={2} strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={points[i].weekStart} cx={x} cy={ys[i]} r={2.5} fill="#D8452F" />
      ))}
      <text
        x={xs[xs.length - 1]}
        y={Math.max(10, ys[ys.length - 1] - 8)}
        textAnchor="end"
        className="fill-foreground text-[11px] font-semibold"
      >
        {last.index}
      </text>
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitabilityPage() {
  const t = useTranslations('citability');
  const locale = useLocale();
  const activeBrandId = useBrandStore((s) => s.activeBrandId);
  const activeBrand = useBrandStore((s) => s.brands.find((b) => b.id === s.activeBrandId) ?? null);
  const [preset, setPreset] = useState<VisibilityIndexPreset>('30d');
  const [data, setData] = useState<VisibilityIndexData | null>(null);
  const [auditTrend, setAuditTrend] = useState<AuditTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [indexData, trendData] = await Promise.all([
          getVisibilityIndex(activeBrandId, preset),
          getAuditTrend(activeBrandId),
        ]);
        if (!cancelled) {
          setData(indexData);
          setAuditTrend(trendData);
        }
      } catch (err) {
        console.error('Failed to load visibility index:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId, preset]);

  // D1 — latest Site Audit score of the primary domain (null = never audited).
  const d1 = useMemo(() => {
    const points = auditTrend?.points ?? [];
    for (let i = points.length - 1; i >= 0; i--) {
      const score = points[i].totalScore;
      if (score !== null) {
        return { score: pct(score) ?? 0, date: points[i].createdAt.slice(0, 10) };
      }
    }
    return null;
  }, [auditTrend]);

  // Pesos efetivos: calibrados no /ops (tabela index_weights) sobre os
  // defaults do framework — a fórmula, as contribuições e a evolução usam
  // sempre o mesmo conjunto.
  const effWeights = useMemo(() => {
    const map = {} as Record<IndexDimKey, number>;
    for (const dim of INDEX_DIMENSIONS) {
      map[dim.key] = data?.weights?.[dim.key] ?? dim.weight;
    }
    return map;
  }, [data]);

  const scores = useMemo(() => {
    if (!data) return null;
    const map: Record<IndexDimKey, number | null> = {
      dim1: d1 ? d1.score : null,
      dim2: data.d2.score,
      dim3: data.categories.social.score,
      // D4: checagem direta de plataformas (migration 00041) quando existe;
      // score null da checagem = nada verificável → mantém o proxy declarado.
      dim4: data.reviewCheck?.score ?? data.categories.reviews.score,
      dim5: data.categories.media.score,
      dim6: data.categories.verticals.score,
    };
    return map;
  }, [data, d1]);

  // Index = weighted average over measured dimensions (only D1 can be
  // missing — before the first audit). Weights renormalized in that case.
  const index = useMemo(() => {
    if (!scores) return null;
    const parts = INDEX_DIMENSIONS.flatMap((dim) => {
      const s = scores[dim.key];
      return s === null ? [] : [{ key: dim.key, weight: effWeights[dim.key], score: s }];
    });
    if (parts.length === 0) return null;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const value = Math.round(parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0));
    return { value, parts, totalWeight };
  }, [scores, effWeights]);

  const dec = locale === 'en' ? '.' : ',';
  const formula = useMemo(() => {
    if (!index) return '';
    const terms = index.parts.map((p) => `0${dec}${String(p.weight).padStart(2, '0')}×${p.score}`);
    return `${terms.join(' + ')} = ${index.value}`;
  }, [index, dec]);

  // Contribution of each measured dimension, in index points.
  const contributions = useMemo(() => {
    if (!index) return [];
    return index.parts.map((p) => {
      const dim = INDEX_DIMENSIONS.find((d) => d.key === p.key)!;
      return {
        key: p.key,
        n: dim.n,
        zone: dim.zone,
        pts: Math.round(((p.score * p.weight) / index.totalWeight) * 10) / 10,
      };
    });
  }, [index]);
  const contributionTotal = contributions.reduce((s, c) => s + c.pts, 0);

  // Weekly index evolution: dims 2–6 from the action, D1 carried forward from
  // the audit trend (latest audit at or before each week).
  const evolution = useMemo(() => {
    if (!data) return [];
    const auditPoints = (auditTrend?.points ?? [])
      .filter((p) => p.totalScore !== null)
      .map((p) => ({ date: p.createdAt.slice(0, 10), score: pct(p.totalScore) ?? 0 }));
    return data.evolution.map((w) => {
      let d1Score: number | null = null;
      for (const a of auditPoints) {
        if (a.date <= w.weekStart) d1Score = a.score;
      }
      const dimScores: Record<IndexDimKey, number | null> = {
        dim1: d1Score,
        dim2: w.d2,
        dim3: w.social,
        dim4: w.reviews,
        dim5: w.media,
        dim6: w.verticals,
      };
      const parts = INDEX_DIMENSIONS.flatMap((dim) => {
        const s = dimScores[dim.key];
        return s === null ? [] : [{ weight: effWeights[dim.key], score: s }];
      });
      const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
      const value =
        totalWeight > 0
          ? Math.round(parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0))
          : 0;
      return { weekStart: w.weekStart, index: value };
    });
  }, [data, auditTrend, effWeights]);

  const handleCopyLlms = async () => {
    const name = activeBrand?.name ?? '';
    const domains = data?.d2.ownDomains ?? [];
    const content = [
      `# ${name}`,
      '',
      `> ${activeBrand?.description ?? t('dims.dim1.llmsDescriptionPlaceholder')}`,
      '',
      `## ${t('dims.dim1.llmsSectionMain')}`,
      ...domains.map((d) => `- [${name}](https://${d}): ${t('dims.dim1.llmsHomeHint')}`),
      '',
      `## ${t('dims.dim1.llmsSectionOptional')}`,
      `- ${t('dims.dim1.llmsOptionalHint')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(content);
      toast.success(t('dims.dim1.llmsCopied'));
    } catch {
      toast.error(t('dims.dim1.llmsCopyFailed'));
    }
  };

  const sharePct =
    data && data.share.total > 0 ? Math.round((data.share.mentioned / data.share.total) * 100) : 0;
  const maxPlatformPct = useMemo(() => {
    if (!data) return 0;
    return Math.max(
      1,
      ...data.share.byPlatform.map((p) => (p.total > 0 ? (p.mentioned / p.total) * 100 : 0)),
    );
  }, [data]);

  const hasData = (data?.totals.results ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {(['7d', '30d', 'all'] as VisibilityIndexPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                preset === p
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t(`period.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Hero — the score with the math always open */}
      <Card className="overflow-hidden border-primary/20">
        <div className="border-l-4" style={{ borderColor: '#D8452F' }}>
          <CardContent className="flex flex-wrap gap-8 p-6">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : !hasData || index === null ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('hero.label')}
                </p>
                <p className="mt-2 text-xl font-medium italic text-muted-foreground">
                  {t('hero.noData')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t('hero.noDataHint')}</p>
              </div>
            ) : (
              <>
                <div className="min-w-[240px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('hero.label')}
                  </p>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="text-5xl font-bold tabular-nums">
                      {index.value}
                      <span className="text-base font-normal text-muted-foreground">/100</span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', BAND_CLASSES[indexScoreBand(index.value)])}
                    >
                      {t(`bands.${indexScoreBand(index.value)}`)}
                    </Badge>
                  </div>
                  <p className="mt-3 rounded-md border border-dashed bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {formula}
                  </p>
                  {scores?.dim1 === null && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      {t('hero.noAuditNote')}
                    </p>
                  )}
                </div>

                <div className="min-w-[260px] flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('hero.contributionTitle')}
                  </p>
                  <div
                    className="mt-2 flex h-4 w-full overflow-hidden rounded-full border"
                    role="img"
                    aria-label={t('hero.contributionAria')}
                  >
                    {contributions.map((c) => (
                      <div
                        key={c.key}
                        style={{
                          width: `${contributionTotal > 0 ? (c.pts / contributionTotal) * 100 : 0}%`,
                          backgroundColor: INDEX_ZONE_COLORS[c.zone],
                        }}
                        title={`${c.n} · ${t('hero.pts', { pts: c.pts })}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {contributions.map((c) => (
                      <span key={c.key} className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ backgroundColor: INDEX_ZONE_COLORS[c.zone] }}
                        />
                        {c.n} {t(`dims.${c.key}.name`)} · {t('hero.pts', { pts: c.pts })}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="min-w-[240px] max-w-[340px] flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('hero.evolutionTitle')}
                  </p>
                  {evolution.length > 1 ? (
                    <EvolutionSparkline points={evolution} ariaLabel={t('hero.evolutionAria')} />
                  ) : (
                    <p className="mt-3 text-xs italic text-muted-foreground">
                      {t('hero.evolutionEmpty')}
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Dimension cards grouped by zone */}
      {INDEX_ZONES.map((zone) => (
        <section key={zone} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: INDEX_ZONE_COLORS[zone] }}
                />
                {t(`zones.${zone}.name`)}
                <Badge variant="outline" className="text-[10px] font-medium">
                  {t('zones.zoneLabel', { zone })}
                </Badge>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`zones.${zone}.desc`)}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {t('zones.weightShare', {
                weight: INDEX_DIMENSIONS.filter((d) => d.zone === zone).reduce(
                  (s, d) => s + effWeights[d.key],
                  0,
                ),
              })}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {INDEX_DIMENSIONS.filter((d) => d.zone === zone).map((dim) => {
              const score = scores?.[dim.key] ?? null;
              const catKey = CATEGORY_BY_DIM[dim.key];
              const cat: IndexCategoryData | null = catKey && data ? data.categories[catKey] : null;
              // D4 com checagem direta ativa substitui o proxy de citações.
              const review =
                dim.key === 'dim4' && data?.reviewCheck && data.reviewCheck.score !== null
                  ? data.reviewCheck
                  : null;
              const directional =
                review === null && cat !== null && cat.sampleCitations < INDEX_LOW_SAMPLE_THRESHOLD;
              const reviewConfirmed = review?.rows.filter((r) => r.found === true) ?? [];
              const reviewUnknown = review?.rows.filter((r) => r.found === null) ?? [];
              const reviewRatings = reviewConfirmed
                .map((r) => r.rating)
                .filter((v): v is number => typeof v === 'number');
              const reviewAvg =
                reviewRatings.length > 0
                  ? Math.round(
                      (reviewRatings.reduce((s, v) => s + v, 0) / reviewRatings.length) * 10,
                    ) / 10
                  : null;

              return (
                <Card
                  key={dim.n}
                  className="flex flex-col overflow-hidden border-l-4"
                  style={{ borderLeftColor: INDEX_ZONE_COLORS[dim.zone] }}
                >
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <span
                            className="font-bold"
                            style={{ color: INDEX_ZONE_COLORS[dim.zone] }}
                          >
                            {dim.n}
                          </span>
                          {t(`dims.${dim.key}.name`)}
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {t('dims.weight', { weight: effWeights[dim.key] })}
                          </Badge>
                        </CardTitle>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t(`dims.${dim.key}.brief`)}
                        </p>
                      </div>
                      {loading ? (
                        <Skeleton className="h-9 w-16" />
                      ) : score === null ? (
                        <span className="text-sm font-medium italic text-muted-foreground">
                          {t('dims.notMeasured')}
                        </span>
                      ) : (
                        <span
                          className={cn('text-3xl font-bold tabular-nums', scoreColorClass(score))}
                        >
                          {score}
                          <span className="text-xs font-normal text-muted-foreground">/100</span>
                        </span>
                      )}
                    </div>
                    {score !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full', scoreBarClass(score))}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col gap-3 pt-0 text-xs">
                    {/* Por quê */}
                    <div>
                      <p className="mb-1 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                        {score === null ? t('dims.whyNone') : t('dims.why', { score })}
                      </p>
                      <ul className="space-y-1 text-muted-foreground">
                        {dim.key === 'dim1' &&
                          (d1 ? (
                            <li>
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                ✓
                              </span>{' '}
                              {t('dims.dim1.evAudit', { date: d1.date, score: d1.score })}
                            </li>
                          ) : (
                            <li>
                              <span className="font-medium text-red-600 dark:text-red-400">✗</span>{' '}
                              {t('dims.dim1.evNoAudit')}
                            </li>
                          ))}
                        {dim.key === 'dim2' && data && (
                          <>
                            <li>
                              <span
                                className={cn(
                                  'font-medium',
                                  data.d2.score >= 50
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400',
                                )}
                              >
                                {data.d2.score >= 50 ? '✓' : '✗'}
                              </span>{' '}
                              {t('dims.dim2.evOwn', {
                                citing: data.d2.resultsCitingOwn,
                                total: data.totals.results,
                                pct: data.d2.pctOwn,
                              })}
                            </li>
                            <li className="italic">{t('dims.dim2.evRuler')}</li>
                          </>
                        )}
                        {review && (
                          <>
                            <li>
                              <span
                                className={cn(
                                  'font-medium',
                                  reviewConfirmed.length >= 2
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400',
                                )}
                              >
                                {reviewConfirmed.length >= 2 ? '✓' : '✗'}
                              </span>{' '}
                              {t('dims.dim4.evDirect', {
                                confirmed: reviewConfirmed.length,
                                total: review.rows.length,
                              })}
                            </li>
                            {reviewAvg !== null && (
                              <li>
                                <span
                                  className={cn(
                                    'font-medium',
                                    reviewAvg >= 4.2
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400',
                                  )}
                                >
                                  {reviewAvg >= 4.2 ? '✓' : '~'}
                                </span>{' '}
                                {t('dims.dim4.evRating', { rating: reviewAvg })}
                              </li>
                            )}
                            {reviewUnknown.length > 0 && (
                              <li className="italic">
                                {t('dims.dim4.evUnknown', { count: reviewUnknown.length })}
                              </li>
                            )}
                          </>
                        )}
                        {!review && cat && (
                          <>
                            <li>
                              <span
                                className={cn(
                                  'font-medium',
                                  cat.score >= 50
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-red-600 dark:text-red-400',
                                )}
                              >
                                {cat.score >= 50 ? '✓' : '✗'}
                              </span>{' '}
                              {t('dims.evPresence', {
                                withBrand: cat.answersWithBrand,
                                citing: cat.answersCiting,
                              })}
                            </li>
                            {directional && (
                              <li className="italic">
                                {t('dims.directional', { count: cat.sampleCitations })}
                              </li>
                            )}
                          </>
                        )}
                      </ul>
                    </div>

                    {/* Fontes pesquisadas — always visible */}
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="mb-1.5 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                        {t('dims.sources')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {dim.key === 'dim1' || dim.key === 'dim2' ? (
                          (data?.d2.ownDomains ?? []).length > 0 ? (
                            (data?.d2.ownDomains ?? []).map((domain) => (
                              <SourceChip
                                key={domain}
                                domain={domain}
                                youAppear
                                appearLabel={t('dims.youAppear')}
                                absentLabel={t('dims.youDontAppear')}
                              />
                            ))
                          ) : (
                            <span className="italic text-muted-foreground">
                              {t('dims.noSources')}
                            </span>
                          )
                        ) : review ? (
                          review.rows.map((r) => (
                            <span
                              key={r.platform}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px]',
                                r.found === null && 'opacity-60',
                              )}
                            >
                              <span>{t(`dims.dim4.platforms.${r.platform}`)}</span>
                              {r.found === true && (
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  ✓{typeof r.rating === 'number' ? ` ${r.rating}` : ''}
                                </span>
                              )}
                              {r.found === false && (
                                <span className="font-medium text-red-600 dark:text-red-400">
                                  ✗
                                </span>
                              )}
                              {r.found === null && <span>{t('dims.dim4.unknownMark')}</span>}
                            </span>
                          ))
                        ) : cat && cat.topSources.length > 0 ? (
                          cat.topSources.map((s) => (
                            <SourceChip
                              key={s.domain}
                              domain={s.domain}
                              youAppear={s.youAppear}
                              appearLabel={t('dims.youAppear')}
                              absentLabel={t('dims.youDontAppear')}
                            />
                          ))
                        ) : (
                          <span className="italic text-muted-foreground">
                            {t('dims.noSources')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {review ? t('dims.dim4.directNote') : t(`dims.${dim.key}.sourcesNote`)}
                      </p>
                    </div>

                    {/* Critérios da nota — réguas do doc de lógica (17/ago),
                        sempre disponíveis; a faixa atual da marca é destacada */}
                    <details className="rounded-md border">
                      <summary className="cursor-pointer select-none px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                        {t('dims.criteriaTitle')}
                      </summary>
                      <div className="space-y-1.5 px-2.5 pb-2.5">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{t('dims.signalLabel')}</span>{' '}
                          {t(`dims.${dim.key}.signal`)}
                        </p>
                        <ul className="space-y-1">
                          {(t.raw(`dims.${dim.key}.criteria`) as string[]).map((text, i) => {
                            const lo = i === 0 ? 0 : INDEX_SCORE_BANDS[i - 1].max + 1;
                            const hi = INDEX_SCORE_BANDS[i].max;
                            const current = score !== null && score >= lo && score <= hi;
                            return (
                              <li
                                key={hi}
                                className={cn(
                                  'flex gap-2 rounded-sm border-l-2 py-0.5 pl-2 text-[11px]',
                                  current
                                    ? 'bg-muted/60 font-medium text-foreground'
                                    : 'border-transparent text-muted-foreground',
                                )}
                                style={
                                  current
                                    ? { borderLeftColor: INDEX_ZONE_COLORS[dim.zone] }
                                    : undefined
                                }
                              >
                                <span className="w-12 shrink-0 tabular-nums">
                                  {lo}–{hi}
                                </span>
                                <span>{text}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </details>

                    {/* CTAs */}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link
                        href={dim.ctaHref}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1')}
                      >
                        {t(`dims.${dim.key}.cta`)}
                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                      </Link>
                      {dim.key === 'dim1' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-[#D8452F]/40 text-[#D8452F] hover:bg-[#D8452F]/10 hover:text-[#D8452F]"
                          onClick={handleCopyLlms}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          {t('dims.dim1.copyLlms')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {/* Share de resposta nos prompts (formerly "Visibilidade") */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              {t('share.title')}
              <span className="text-xs font-normal text-muted-foreground line-through">
                {t('share.oldName')}
              </span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {t('share.chip')}
              </Badge>
            </CardTitle>
            {!loading && hasData && (
              <span className="text-2xl font-bold tabular-nums">
                {sharePct}%
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t('share.headline', {
                    mentioned: data?.share.mentioned ?? 0,
                    total: data?.share.total ?? 0,
                  })}
                </span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : !hasData ? (
            <p className="text-sm italic text-muted-foreground">{t('share.empty')}</p>
          ) : (
            <>
              <table className="w-full max-w-2xl text-xs">
                <tbody>
                  {data?.share.byPlatform.map((p) => {
                    const platformPct = p.total > 0 ? Math.round((p.mentioned / p.total) * 100) : 0;
                    return (
                      <tr key={p.platform} className="border-t border-border/50 first:border-t-0">
                        <td className="w-36 py-1.5 pr-2 font-medium">
                          {PLATFORM_LABELS[p.platform] ?? p.platform}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="h-2.5 w-full overflow-hidden rounded-sm bg-muted">
                            <div
                              className="h-full rounded-sm bg-foreground/60"
                              style={{ width: `${(platformPct / maxPlatformPct) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="w-28 whitespace-nowrap py-1.5 text-right tabular-nums text-muted-foreground">
                          {platformPct}% · {p.mentioned}/{p.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Share direto × orgânico (prompts de marca — migration 00040) */}
              <p className="text-xs text-muted-foreground">
                {data && data.share.direct.total > 0 ? (
                  <>
                    <span className="font-medium text-foreground">
                      {t('share.direct')}:{' '}
                      {Math.round((data.share.direct.mentioned / data.share.direct.total) * 100)}%
                    </span>{' '}
                    · {data.share.direct.mentioned}/{data.share.direct.total} ·{' '}
                    <span className="font-medium text-foreground">
                      {t('share.organic')}:{' '}
                      {data.share.organic.total > 0
                        ? Math.round(
                            (data.share.organic.mentioned / data.share.organic.total) * 100,
                          )
                        : 0}
                      %
                    </span>{' '}
                    · {data.share.organic.mentioned}/{data.share.organic.total}
                  </>
                ) : (
                  <em>{t('share.directPending')}</em>
                )}
              </p>
              <p className="inline-block rounded-md border border-dashed bg-muted/40 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {t('share.reconciliation', {
                  sums: data?.share.byPlatform.map((p) => p.mentioned).join('+') ?? '',
                  mentioned: data?.share.mentioned ?? 0,
                  total: data?.share.total ?? 0,
                  pct: sharePct,
                })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fase 2 — visible, out of scope */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Eye className="h-3.5 w-3.5" />
          {t('phase2.title')}
        </span>
        {(t.raw('phase2.items') as string[]).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}
