'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  getInsightsBreakdown,
  type BreakdownMetric,
  type BreakdownRow,
  type InsightsBreakdown,
} from '@/lib/actions/tracking';
import { sortBreakdownRowsForDisplay } from './breakdown-display';

type Translator = ReturnType<typeof useTranslations>;

interface Props {
  brandId: string | null;
  metric: BreakdownMetric | null;
  onOpenChange: (open: boolean) => void;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    region?: string;
    model?: string;
    topicId?: string;
  };
}

export function MetricBreakdownSheet({ brandId, metric, onOpenChange, filters }: Props) {
  const t = useTranslations('insights');
  const open = Boolean(brandId && metric);
  const [data, setData] = useState<InsightsBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters is passed as a fresh object each render from the parent — derive a
  // stable cache key so the fetch effect doesn't re-run needlessly.
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  useEffect(() => {
    if (!open || !brandId || !metric) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getInsightsBreakdown(brandId, metric, filters)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('breakdown.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // filtersKey is the stable dependency; `filters` is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brandId, metric, filtersKey]);

  const title = metric
    ? t('breakdown.sheetTitle', {
        metric: metric === 'visibility' ? t('breakdown.metricVisibility') : t('mentions'),
      })
    : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full flex flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetDescription className="text-xs">
            {data
              ? t('breakdown.windowCompare', { days: data.windowDays })
              : t('breakdown.windowCompareFallback')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <BreakdownSkeleton />}

          {error && !loading && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && data && metric && <BreakdownBody data={data} metric={metric} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BreakdownSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function BreakdownBody({ data, metric }: { data: InsightsBreakdown; metric: BreakdownMetric }) {
  const t = useTranslations('insights');
  const [tab, setTab] = useState<'prompts' | 'platforms' | 'topics'>('prompts');

  const pickRows = () =>
    tab === 'prompts' ? data.byPrompt : tab === 'platforms' ? data.byPlatform : data.byTopic;

  const unit = metric === 'visibility' ? ` ${t('breakdown.pts')}` : '';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('breakdown.currentWindow', { days: data.windowDays })}
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatValue(data.curTotal, metric)}
              <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {t('breakdown.vsPrevious')}{' '}
              <span className="tabular-nums">
                {formatValue(data.prevTotal, metric)}
                {unit}
              </span>
            </div>
          </div>
          <DeltaPill delta={data.delta} deltaPct={data.deltaPct} metric={metric} big />
        </div>
        <RootCauseSummary data={data} metric={metric} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="prompts">
            {t('breakdown.tabPrompts')}
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {data.byPrompt.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="platforms">
            {t('breakdown.tabPlatforms')}
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {data.byPlatform.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="topics">
            {t('breakdown.tabTopics')}
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {data.byTopic.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3">
          <BreakdownTable rows={pickRows()} metric={metric} kind={tab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RootCauseSummary({ data, metric }: { data: InsightsBreakdown; metric: BreakdownMetric }) {
  const t = useTranslations('insights');
  const isDrop = data.delta < 0;
  const isFlat = data.delta === 0;
  const topPrompt = isDrop ? data.byPrompt[0] : data.byPrompt[data.byPrompt.length - 1];
  const topPlatform = isDrop ? data.byPlatform[0] : data.byPlatform[data.byPlatform.length - 1];
  const promptContributes = !!topPrompt && (isDrop ? topPrompt.delta < 0 : topPrompt.delta > 0);
  const platformContributes =
    !!topPlatform && (isDrop ? topPlatform.delta < 0 : topPlatform.delta > 0);

  if (isFlat || !promptContributes || !topPrompt) {
    return (
      <div className="mt-2 text-xs text-muted-foreground leading-relaxed">{data.rootCause}</div>
    );
  }

  return (
    <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
      {isDrop ? t('breakdown.biggestDrop') : t('breakdown.biggestGain')}:{' '}
      <Link
        href={`/dashboard/prompts/${topPrompt.id}`}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        &quot;{truncate(topPrompt.label, 60)}&quot;
      </Link>{' '}
      {formatContribution(topPrompt, metric, t)}.
      {platformContributes && topPlatform && (
        <>
          {' '}
          {isDrop ? t('breakdown.topPlatformDrop') : t('breakdown.topPlatformGain')}:{' '}
          {topPlatform.label} {formatContribution(topPlatform, metric, t)}.
        </>
      )}
    </div>
  );
}

function BreakdownTable({
  rows,
  metric,
  kind,
}: {
  rows: BreakdownRow[];
  metric: BreakdownMetric;
  kind: 'prompts' | 'platforms' | 'topics';
}) {
  const t = useTranslations('insights');

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {t('breakdown.emptyWindow')}
      </div>
    );
  }

  // `overflow-hidden` sozinho CLIPA: numa sheet estreita a última coluna some
  // e não há como alcançá-la. `overflow-x-auto` deixa rolar.
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="text-left font-medium px-3 py-2">{t('breakdown.colName')}</th>
            <th className="text-right font-medium px-2 py-2 w-16">{t('breakdown.colPrev')}</th>
            <th className="text-right font-medium px-2 py-2 w-16">{t('breakdown.colCur')}</th>
            <th className="text-right font-medium px-2 py-2 w-24">{t('breakdown.colChange')}</th>
          </tr>
        </thead>
        <tbody>
          {sortBreakdownRowsForDisplay(rows).map((r) => (
            <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-3 py-2.5 min-w-0">
                {kind === 'prompts' ? (
                  <Link
                    href={`/dashboard/prompts/${r.id}`}
                    className="line-clamp-2 text-sm transition-colors hover:text-primary hover:underline"
                  >
                    {r.label}
                  </Link>
                ) : (
                  <div className="line-clamp-2 text-sm">{r.label}</div>
                )}
                {r.sublabel && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{r.sublabel}</div>
                )}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                {formatValue(r.prev, metric)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatValue(r.cur, metric)}</td>
              <td className="px-2 py-2 text-right">
                <DeltaPill delta={r.delta} deltaPct={r.deltaPct} metric={metric} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeltaPill({
  delta,
  deltaPct,
  metric,
  big = false,
}: {
  delta: number;
  deltaPct: number | null;
  metric: BreakdownMetric;
  big?: boolean;
}) {
  const t = useTranslations('insights');

  if (delta === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 text-muted-foreground tabular-nums',
          big ? 'text-sm' : 'text-xs',
        )}
      >
        <Minus className={big ? 'h-3.5 w-3.5' : 'h-3 w-3'} />0
      </span>
    );
  }

  const positive = delta > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? 'text-green-600 dark:text-green-400' : 'text-red-500';

  // Prefer percentage display for count metrics when available; fall back to
  // absolute delta for visibility (pts) or when previous was zero.
  const showPct = metric !== 'visibility' && deltaPct !== null;
  const sign = positive ? '+' : '';
  const primary = showPct
    ? `${sign}${deltaPct}%`
    : metric === 'visibility'
      ? `${sign}${delta} ${t('breakdown.pts')}`
      : `${sign}${delta}`;
  const secondary = showPct ? `${sign}${delta}` : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium tabular-nums',
        big ? 'text-sm' : 'text-xs',
        color,
      )}
    >
      <Icon className={big ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      <span>{primary}</span>
      {secondary && (
        <span className={cn('font-normal text-muted-foreground', big ? 'text-xs' : 'text-[10px]')}>
          ({secondary})
        </span>
      )}
    </span>
  );
}

function formatValue(value: number, metric: BreakdownMetric): string {
  if (metric === 'visibility') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return value.toLocaleString();
}

function formatContribution(row: BreakdownRow, metric: BreakdownMetric, t: Translator): string {
  const isLoss = row.delta < 0;
  const abs = Math.abs(row.delta);

  if (metric === 'visibility') {
    const value = Math.round(abs * 10) / 10;
    return isLoss ? t('breakdown.dropped', { value }) : t('breakdown.rose', { value });
  }

  const core = isLoss
    ? t('breakdown.lostMentions', { count: abs })
    : t('breakdown.gainedMentions', { count: abs });
  if (row.deltaPct === null) return core;
  const sign = row.deltaPct < 0 ? '−' : '+';
  return `${core} (${sign}${Math.abs(row.deltaPct)}%)`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
