'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Citability Index (Índice de Citabilidade) — the prescriptive counterpart
 * to the Insights page: Insights is the scoreboard, this is the playbook.
 * Framework source of truth: `estrategia/indice-citabilidade.md`.
 *
 * v1 scoring is deliberately partial and honest: only dimensions the
 * platform already measures get a number (D1 from the latest Site Audit,
 * D2 from owned-citation coverage). D3–D6 show the sector "answer key" —
 * the domains AI engines actually cite for this brand's prompts, grouped
 * by source category — instead of an invented score.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Eye, FileText, Gauge } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandStore } from '@/stores/use-brand-store';
import { getAudits, type AuditSummary } from '@/lib/actions/audits';
import { getCitationsOverview, type CitationsOverview } from '@/lib/actions/citations';
import { pct } from '@/components/audit/audit-report';
import type { SourceCategory } from '@/lib/citations/classify';

// ─── Framework constants (mirror estrategia/indice-citabilidade.md) ─────────

type Zone = 'A' | 'B' | 'C';

const ZONE_COLORS: Record<Zone, string> = {
  A: '#2a78d6',
  B: '#eb6834',
  C: '#1baf7a',
};

interface Dimension {
  n: string;
  key: 'dim1' | 'dim2' | 'dim3' | 'dim4' | 'dim5' | 'dim6';
  weight: number;
  zone: Zone;
  /** Matrix position: x = internal↔external, y = third-party dependency. */
  x: number;
  y: number;
  /** Citation source categories that feed this dimension's "answer key". */
  categories?: SourceCategory[];
}

const DIMENSIONS: Dimension[] = [
  { n: '01', key: 'dim1', weight: 15, zone: 'A', x: 12, y: 12 },
  { n: '02', key: 'dim2', weight: 20, zone: 'A', x: 22, y: 24 },
  { n: '03', key: 'dim3', weight: 12, zone: 'B', x: 56, y: 30, categories: ['social'] },
  { n: '04', key: 'dim4', weight: 18, zone: 'B', x: 70, y: 48, categories: ['review', 'forum'] },
  { n: '05', key: 'dim5', weight: 22, zone: 'C', x: 84, y: 72, categories: ['editorial', 'other'] },
  { n: '06', key: 'dim6', weight: 13, zone: 'C', x: 92, y: 87, categories: ['institutional'] },
];

const ZONES: Zone[] = ['A', 'B', 'C'];

// ─── KPI card (mirrors the Citations page KPI styling) ───────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string;
  sub: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-bold tabular-nums">{value}</div>
        )}
        <p className="text-xs mt-1 text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Matrix (SVG) ────────────────────────────────────────────────────────────

function CitabilityMatrix({ dimLabel }: { dimLabel: (key: Dimension['key']) => string }) {
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitabilityPage() {
  const t = useTranslations('citability');
  const activeBrandId = useBrandStore((s) => s.activeBrandId);
  const [audits, setAudits] = useState<AuditSummary[] | null>(null);
  const [overview, setOverview] = useState<CitationsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [auditData, citationData] = await Promise.all([
          getAudits(activeBrandId),
          getCitationsOverview(activeBrandId, { datePreset: 'all' }),
        ]);
        if (!cancelled) {
          setAudits(auditData);
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

  // D1 — latest completed Site Audit score (0–100).
  const d1Score = useMemo(() => {
    const latest = (audits ?? []).find((a) => a.status === 'completed' && a.total_score !== null);
    return latest ? pct(latest.total_score) : null;
  }, [audits]);

  // D2 — owned-citation coverage: share of tracked AI answers citing the
  // brand's own domain. A proxy for "each question has an own, extractable
  // page" — if the pages existed and ranked, the AIs would cite them.
  const d2Score = useMemo(() => {
    if (!overview || overview.totals.results === 0) return null;
    const ownedResults = overview.rows
      .filter((r) => r.category === 'you')
      .reduce((sum, r) => sum + r.resultsCiting, 0);
    return Math.min(100, Math.round((ownedResults / overview.totals.results) * 100));
  }, [overview]);

  // Partial IC: weighted average over the dimensions we can score today,
  // weights renormalized. Never a full IC — v1 doesn't measure D3–D6.
  const partialScore = useMemo(() => {
    const parts: Array<{ score: number; weight: number }> = [];
    if (d1Score !== null) parts.push({ score: d1Score, weight: 15 });
    if (d2Score !== null) parts.push({ score: d2Score, weight: 20 });
    if (parts.length === 0) return null;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    return Math.round(parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0));
  }, [d1Score, d2Score]);

  // "Answer key" per dimension: top cited domains in that dimension's
  // source categories — the real list of sources AI engines cite for this
  // brand's prompts.
  const answerKey = useMemo(() => {
    const map = new Map<Dimension['key'], { domain: string; totalCitations: number }[]>();
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

  const dimScore = (key: Dimension['key']): number | null =>
    key === 'dim1' ? d1Score : key === 'dim2' ? d2Score : null;

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
        <KpiCard
          title={t('kpis.icTitle')}
          value={partialScore === null ? '—' : `${partialScore}`}
          sub={t('kpis.icHint')}
          icon={Eye}
          loading={loading}
        />
        <KpiCard
          title={t('kpis.d1Title')}
          value={d1Score === null ? '—' : `${d1Score}`}
          sub={
            d1Score === null ? (
              <Link
                href="/dashboard/audit"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {t('dims.runAuditCta')}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : (
              t('kpis.d1Hint')
            )
          }
          icon={Gauge}
          loading={loading}
        />
        <KpiCard
          title={t('kpis.d2Title')}
          value={d2Score === null ? '—' : `${d2Score}`}
          sub={t('kpis.d2Hint')}
          icon={FileText}
          loading={loading}
        />
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

      {/* Dimension cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DIMENSIONS.map((dim) => {
          const score = dimScore(dim.key);
          const domains = answerKey.get(dim.key) ?? [];
          return (
            <Card key={dim.n}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: ZONE_COLORS[dim.zone] }}>
                    {dim.n} · {t(`zones.${dim.zone}.name`)}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {t('dims.weight', { weight: dim.weight })}
                  </Badge>
                </div>
                <CardTitle className="text-sm">{t(`dims.${dim.key}.name`)}</CardTitle>
                <p className="text-xs font-medium text-primary">{t(`dims.${dim.key}.action`)}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <p>{t(`dims.${dim.key}.desc`)}</p>
                {loading ? (
                  <Skeleton className="h-8 w-full" />
                ) : dim.categories ? (
                  domains.length > 0 ? (
                    <div className="rounded-md border bg-muted/30 p-2.5">
                      <p className="mb-1.5 font-medium text-foreground">{t('dims.answerKey')}</p>
                      <ul className="space-y-1">
                        {domains.map((d) => (
                          <li key={d.domain} className="flex justify-between gap-2">
                            <span className="truncate">{d.domain}</span>
                            <span className="shrink-0 tabular-nums">
                              {t('dims.citationCount', { count: d.totalCitations })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="italic">{t('dims.noCitations')}</p>
                  )
                ) : (
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {score === null ? '—' : score}
                    </span>
                    {dim.key === 'dim1' && score === null && (
                      <Link
                        href="/dashboard/audit"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {t('dims.runAuditCta')}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action plan by zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('plan.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('plan.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {ZONES.map((zone) => (
              <div key={zone} className="rounded-lg border p-4">
                <p className="text-sm font-semibold" style={{ color: ZONE_COLORS[zone] }}>
                  {t(`zones.${zone}.name`)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`zones.${zone}.desc`)}</p>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {DIMENSIONS.filter((d) => d.zone === zone).map((d) => (
                    <li key={d.n} className="flex gap-2">
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: ZONE_COLORS[zone] }}
                      >
                        {d.n}
                      </span>
                      <span>{t(`dims.${d.key}.action`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
