'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
const CompetitorChart = dynamic(() => import('./_charts').then((m) => m.CompetitorChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

const CompetitorLeaderboard = dynamic(
  () => import('./_charts').then((m) => m.CompetitorLeaderboard),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);

const ShareOfVoicePlatformChart = dynamic(
  () => import('./_charts').then((m) => m.ShareOfVoicePlatformChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);

const ShareOfVoiceTrendChart = dynamic(
  () => import('./_charts').then((m) => m.ShareOfVoiceTrendChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);
import { MetricBreakdownSheet } from './_metric-breakdown-sheet';
import { useBrandStore } from '@/stores/use-brand-store';
import {
  getInsightsData,
  triggerTrackingCheck,
  getJobStatus,
  cancelTrackingJob,
  getBrandPrompts,
  exportPromptResults,
  type InsightsSummary,
  type TrackedPromptsKpi,
  type VisibilityRateKpi,
  type CompetitorComparisonData,
  type ShareOfVoiceData,
  type TrackingJobStatus,
  type BreakdownMetric,
} from '@/lib/actions/tracking';
import { getTopics } from '@/lib/actions/topic';
import { MODEL_PROVIDER_LABELS, PLATFORM_LABELS } from '@/config/platform-labels';
import { formatRegionDisplay } from '@/lib/region';
import type { Topic } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BarChart3,
  CalendarX2,
  Eye,
  HelpCircle,
  Play,
  TrendingUp,
  TrendingDown,
  ListOrdered,
  AlertCircle,
  Loader2,
  FlaskConical,
  PieChart,
  Users,
  StopCircle,
  ArrowRight,
  ArrowUpRight,
  Download,
  Layers,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getAIProviderDisplayName, resolveAIProvider } from '@/components/ai-provider-avatar';
import { usePlanContext } from '@/components/providers/plan-provider';
import { toast } from 'sonner';

// ─── Filter Types ─────────────────────────────────────────────────────────────

type DatePreset = '24h' | '7d' | '30d' | '90d' | 'all' | 'custom';

interface InsightsFilters {
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  region: string;
  model: string;
  topic: string;
}

const DEFAULT_FILTERS: InsightsFilters = {
  datePreset: '24h',
  dateFrom: '',
  dateTo: '',
  region: '',
  model: '',
  topic: '',
};

const INSIGHT_EXPORT_HEADERS = [
  'created_at',
  'prompt',
  'topic',
  'platform',
  'model',
  'region',
  'mention_count',
  'citation_count',
  'visibility_score',
  'sentiment',
  'citation_urls',
  'competitor_mentions',
];

function getDateRange(preset: DatePreset, custom: { from: string; to: string }) {
  if (preset === 'all') return { dateFrom: undefined, dateTo: undefined };
  if (preset === 'custom') {
    return {
      dateFrom: custom.from || undefined,
      dateTo: custom.to ? `${custom.to}T23:59:59.999Z` : undefined,
    };
  }
  if (preset === '24h') {
    const from = new Date();
    from.setHours(from.getHours() - 24);
    return { dateFrom: from.toISOString(), dateTo: undefined };
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { dateFrom: from.toISOString(), dateTo: undefined };
}

// ─── Info Tooltip ─────────────────────────────────────────────────────────────

function InfoTip({ content }: { content: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        className="inline-flex items-center cursor-help"
      >
        <HelpCircle className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
      </span>
      {pos &&
        createPortal(
          <div
            style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
            className="pointer-events-none fixed z-[9999] w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, suffix = '%' }: { delta: number | null; suffix?: string }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="text-xs text-muted-foreground">— 0{suffix}</span>;
  const pos = delta > 0;
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        pos ? 'text-green-600 dark:text-green-400' : 'text-red-500',
      )}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}
      {delta}
      {suffix}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  tooltip,
  icon: Icon,
  value,
  sub,
  subVariant = 'muted',
  onClick,
}: {
  title: string;
  tooltip: string;
  icon: React.ElementType;
  value: React.ReactNode;
  sub: React.ReactNode;
  subVariant?: 'muted' | 'positive';
  onClick?: () => void;
}) {
  const t = useTranslations('insights');
  const clickable = typeof onClick === 'function';
  return (
    <Card
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${title} — ${t('clickBreakdown')}` : undefined}
      title={clickable ? t('clickBreakdown') : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'group relative',
        clickable &&
          'cursor-pointer transition-all duration-150 hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
          <InfoTip content={tooltip} />
        </CardTitle>
        <div className="relative flex h-4 w-4 items-center justify-center">
          <Icon
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-opacity',
              clickable && 'group-hover:opacity-0',
            )}
          />
          {clickable && (
            <ArrowUpRight
              className="absolute h-4 w-4 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p
          className={cn(
            'text-xs mt-1 flex items-center gap-0.5',
            subVariant === 'positive'
              ? 'text-green-600 dark:text-green-400'
              : 'text-muted-foreground',
          )}
        >
          {sub}
        </p>
        {clickable && (
          <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
            {t('viewBreakdown')}
            <ArrowUpRight className="h-2.5 w-2.5" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Run Single Prompt Dialog ─────────────────────────────────────────────────

function RunSinglePromptDialog({
  brandId,
  open,
  onClose,
  onJobStarted,
}: {
  brandId: string;
  open: boolean;
  onClose: () => void;
  onJobStarted: (jobId: string) => void;
}) {
  const t = useTranslations('insights');
  const [prompts, setPrompts] = useState<
    { id: string; text: string; category?: string; platforms: string[] }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getBrandPrompts(brandId)
      .then(setPrompts)
      .catch(() => toast.error(t('loadPromptsFailed')))
      .finally(() => setLoading(false));
  }, [open, brandId, t]);

  const handleRun = async (promptId: string) => {
    setRunningId(promptId);
    try {
      const { jobId } = await triggerTrackingCheck(brandId, { promptId });
      onClose();
      onJobStarted(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('runPromptFailed'));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            {t('runSingleTitle')}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t('runSingleDesc')}</p>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {!loading && prompts.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('noActivePrompts')}</p>
          )}

          {!loading &&
            prompts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2">{p.text}</p>
                  {p.category && (
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {p.category}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  disabled={runningId !== null}
                  onClick={() => handleRun(p.id)}
                >
                  {runningId === p.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {t('run')}
                </Button>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  availableRegions,
  availableModels,
  availableTopics,
}: {
  filters: InsightsFilters;
  onChange: (f: InsightsFilters) => void;
  availableRegions: string[];
  availableModels: string[];
  availableTopics: Topic[];
}) {
  const t = useTranslations('insights');
  const set = (patch: Partial<InsightsFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Date presets */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('dateRange')}
        </label>
        <div className="flex rounded-md border overflow-hidden">
          {(['24h', '7d', '30d', '90d', 'all', 'custom'] as DatePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set({ datePreset: p })}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                filters.datePreset === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-muted text-foreground',
              )}
            >
              {p === 'custom' ? t('presetCustom') : p === 'all' ? t('presetAll') : p}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      {filters.datePreset === 'custom' && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t('dateFrom')}
            </label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set({ dateFrom: e.target.value })}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t('dateTo')}
            </label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
              className="h-8 w-36 text-xs"
            />
          </div>
        </>
      )}

      {/* Topic filter */}
      {availableTopics.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t('topicFilter')}
          </label>
          <Select
            value={filters.topic || null}
            onValueChange={(v) => set({ topic: !v || v === '__all__' ? '' : v })}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder={t('allTopics')}>
                {(value) =>
                  value && value !== '__all__'
                    ? (availableTopics.find((t) => t.id === value)?.name ?? t('allTopics'))
                    : t('allTopics')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('allTopics')}</SelectItem>
              {availableTopics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Region filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('regionFilter')}
        </label>
        <Select
          value={filters.region || null}
          onValueChange={(v) => set({ region: !v || v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder={t('allRegions')}>
              {(value) =>
                value && value !== '__all__' ? formatRegionDisplay(String(value)) : t('allRegions')
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allRegions')}</SelectItem>
            {availableRegions.map((r) => (
              <SelectItem key={r} value={r}>
                {formatRegionDisplay(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model filter */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t('aiModel')}
        </label>
        <Select
          value={filters.model || null}
          onValueChange={(v) => set({ model: !v || v === '__all__' ? '' : v })}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder={t('allPlatforms')}>
              {(value) => {
                if (!value || value === '__all__') return t('allPlatforms');
                const firstSlug = String(value).split(',')[0];
                return (
                  MODEL_PROVIDER_LABELS[firstSlug] ??
                  PLATFORM_LABELS[firstSlug] ??
                  getAIProviderDisplayName(resolveAIProvider(firstSlug))
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('allPlatforms')}</SelectItem>
            {availableModels.map((m) => {
              // m is a comma-separated slug list representing a provider family
              const firstSlug = m.split(',')[0];
              return (
                <SelectItem key={m} value={m}>
                  {MODEL_PROVIDER_LABELS[firstSlug] ??
                    PLATFORM_LABELS[firstSlug] ??
                    getAIProviderDisplayName(resolveAIProvider(firstSlug))}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  onRunPrompts,
  isRunning,
  isCloud,
}: {
  onRunPrompts: () => void;
  isRunning: boolean;
  isCloud: boolean;
}) {
  const t = useTranslations('insights');
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
      <p className="text-muted-foreground text-sm mt-1 max-w-md">{t('emptyBody')}</p>
      {!isCloud && (
        <Button onClick={onRunPrompts} disabled={isRunning} className="mt-6 gap-2">
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {t('runPromptsNow')}
        </Button>
      )}
    </div>
  );
}

function NoDataForPeriod({ datePreset, onReset }: { datePreset: DatePreset; onReset: () => void }) {
  const t = useTranslations('insights');
  const labels: Record<DatePreset, string> = {
    '24h': t('period24h'),
    '7d': t('period7d'),
    '30d': t('period30d'),
    '90d': t('period90d'),
    all: t('periodSelected'),
    custom: t('periodSelected'),
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarX2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <h3 className="text-base font-semibold">
        {t('noPeriodTitle', { period: labels[datePreset] })}
      </h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm">{t('noPeriodBody')}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
        {t('showAllData')}
      </Button>
    </div>
  );
}

// ─── Tracking Progress ────────────────────────────────────────────────────────

import { saveTrackingJob, loadTrackingJob, clearTrackingJob } from '@/lib/tracking-job-store';
import { toCsv } from '@/lib/csv';

function TrackingProgressBanner({
  jobStatus,
  onStop,
}: {
  jobStatus: TrackingJobStatus | null;
  onStop: () => void;
}) {
  const t = useTranslations('insights');

  if (!jobStatus) return null;

  const isActive = jobStatus.status === 'active' || jobStatus.status === 'waiting';
  if (!isActive) return null;

  const progress = jobStatus.progress;
  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">
            {jobStatus.status === 'waiting' ? t('queued') : t('analyzing')}
          </span>
          {progress && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.current}/{progress.total}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onStop}
        >
          <StopCircle className="h-3.5 w-3.5" />
          {t('stop')}
        </Button>
      </div>

      {jobStatus.status === 'waiting' && (
        <p className="text-xs text-muted-foreground">{t('queuedExplain')}</p>
      )}

      {progress && progress.total > 0 && (
        <>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          {progress.promptText && (
            <p className="text-xs text-muted-foreground truncate">
              {progress.model && (
                <span className="font-medium text-foreground">
                  {PLATFORM_LABELS[progress.model] ?? progress.model}
                  {progress.region && <span> · {progress.region}</span>}
                  {' — '}
                </span>
              )}
              {progress.promptText}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── No Competitors Teaser ────────────────────────────────────────────────────

/**
 * Shown in place of the Competitor Comparison section when the brand has no
 * tracked competitors yet (#507). Gives users a clear path to
 * /dashboard/competitors so the head-to-head feature is discoverable even
 * before any competitors are added.
 */
function NoCompetitorsTeaser() {
  const t = useTranslations('insights');
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 p-8 text-center">
      <Users className="h-8 w-8 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-foreground">{t('noCompetitorsTitle')}</p>
        <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{t('noCompetitorsBody')}</p>
      </div>
      <Link
        href="/dashboard/competitors"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        {t('headToHead')}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ─── Confirm before dispatching a full run (scrapes cost credit & are ─────────
//     irreversible once sent — guards against an accidental "Run all") ─────────

function ConfirmRunDialog({
  open,
  onClose,
  onConfirm,
  promptCount,
  isRunning,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  promptCount: number | null;
  isRunning: boolean;
}) {
  const t = useTranslations('insights');
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            {t('confirmRun.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1 text-sm text-muted-foreground">
          <p>
            {promptCount && promptCount > 0
              ? t('confirmRun.bodyCount', { count: promptCount })
              : t('confirmRun.body')}
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
            {t('confirmRun.warning')}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={onClose} disabled={isRunning}>
            {t('confirmRun.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isRunning} className="gap-2">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('confirmRun.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const t = useTranslations('insights');
  const router = useRouter();
  const { isCloud } = usePlanContext();
  const brand = useBrandStore((s) => s.getActiveBrand());
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [trackedPrompts, setTrackedPrompts] = useState<TrackedPromptsKpi | null>(null);
  const [visibilityRate, setVisibilityRate] = useState<VisibilityRateKpi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<TrackingJobStatus | null>(null);
  const [showSinglePrompt, setShowSinglePrompt] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [filters, setFilters] = useState<InsightsFilters>(DEFAULT_FILTERS);
  const [hasAnyData, setHasAnyData] = useState<boolean | null>(null);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [competitorData, setCompetitorData] = useState<CompetitorComparisonData | null>(null);
  const [sovData, setSovData] = useState<ShareOfVoiceData | null>(null);
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const loadData = useCallback(
    async (overrideFilters?: InsightsFilters, { silent = false } = {}) => {
      if (!brand) return;
      if (!silent) setIsLoading(true);
      try {
        const f = overrideFilters ?? filtersRef.current;
        const { dateFrom, dateTo } = getDateRange(f.datePreset, {
          from: f.dateFrom,
          to: f.dateTo,
        });
        const filterOpts = {
          model: f.model || undefined,
          region: f.region || undefined,
          topicId: f.topic || undefined,
          dateFrom,
          dateTo,
        };

        const hasFilters = Boolean(f.datePreset !== 'all' || f.model || f.region || f.topic);

        // One consolidated server action (#313): summary + competitor + SoV
        // run in a real server-side Promise.all (one round trip instead of
        // five serialized POSTs), and "has any data" comes from a cheap
        // count instead of an unbounded full-table scan.
        const insights = await getInsightsData(brand.id, {
          ...filterOpts,
          checkUnfiltered: hasFilters,
        });
        setSummary(insights.summary);
        setTrackedPrompts(insights.trackedPrompts);
        setVisibilityRate(insights.visibilityRate);
        setCompetitorData(insights.competitors.brands.length > 1 ? insights.competitors : null);
        setSovData(insights.sov.byPlatform.length > 0 ? insights.sov : null);
        setHasAnyData(insights.hasAnyData);

        // Group raw model slugs by their resolved display name so different
        // ChatGPT versions ("gpt-5-3-mini" + "gpt-5-5") collapse into one
        // "ChatGPT" filter option. Stored as `slugA,slugB` so the server can
        // filter the whole family with .in() via applyModelFilter().
        const slugToLabel = new Map<string, string>();
        for (const slug of insights.filterOptions.models) {
          if (slugToLabel.has(slug)) continue;
          const label =
            MODEL_PROVIDER_LABELS[slug] ??
            PLATFORM_LABELS[slug] ??
            getAIProviderDisplayName(resolveAIProvider(slug));
          slugToLabel.set(slug, label);
        }
        const familyToSlugs = new Map<string, string[]>();
        for (const [slug, label] of slugToLabel) {
          const arr = familyToSlugs.get(label) ?? [];
          arr.push(slug);
          familyToSlugs.set(label, arr);
        }
        const models = Array.from(familyToSlugs.values())
          .map((slugs) => slugs.sort().join(','))
          .sort();
        setAvailableRegions([...insights.filterOptions.regions].sort((a, b) => a.localeCompare(b)));
        setAvailableModels(models.sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        const message = err instanceof Error ? err.message : '';

        // Next.js surfaces this when a server action's response stream is
        // cut because the user navigated away mid-load. The destination
        // page renders fine; the toast is pure noise. Matched
        // case-insensitively so a wording tweak between Next versions
        // doesn't reopen the issue.
        if (/unexpected response/i.test(message)) {
          console.debug('[insights] load aborted by navigation', err);
        } else if (!silent) {
          toast.error(message || t('loadInsightsFailed'));
        } else {
          // Silent refreshes fire every ~10s while a tracking job runs; a
          // transient 5xx or network blip there shouldn't pop a red toast —
          // the next poll will retry and the user sees nothing.
          console.warn('[insights] silent refresh failed', err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [brand, t],
  );

  useEffect(() => {
    if (!brand?.id) return;
    setAvailableRegions([]);
    setAvailableModels([]);
    setAvailableTopics([]);
    const next = { ...filtersRef.current, region: '', model: '', topic: '' };
    filtersRef.current = next;
    setFilters(next);
    getTopics(brand.id)
      .then(setAvailableTopics)
      .catch(() => {});
  }, [brand?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Restore active job from localStorage or URL query param (post-payment redirect)
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!brand) return;

    const urlJobId = searchParams.get('jobId');
    if (urlJobId) {
      saveTrackingJob({ jobId: urlJobId, brandId: brand.id, startedAt: Date.now() });
      setActiveJobId(urlJobId);
      setIsRunning(true);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const saved = loadTrackingJob();
    if (saved && saved.brandId === brand.id) {
      setActiveJobId(saved.jobId);
      setIsRunning(true);
    }
  }, [brand, searchParams]);

  // Poll job status while a job is active
  useEffect(() => {
    if (!activeJobId) return;

    let cancelled = false;
    let lastRefresh = 0;
    const poll = async () => {
      while (!cancelled) {
        try {
          const status = await getJobStatus(activeJobId);
          if (cancelled) break;
          setJobStatus(status);

          // Refresh data every ~10s while active so new results appear progressively
          const now = Date.now();
          if (status.status === 'active' && now - lastRefresh > 10_000) {
            lastRefresh = now;
            loadData(undefined, { silent: true });
          }

          if (status.status === 'completed') {
            clearTrackingJob();
            setActiveJobId(null);
            setIsRunning(false);
            setJobStatus(null);
            toast.success(t('analysisComplete', { count: status.result?.resultCount ?? 0 }));
            loadData(undefined, { silent: true });
            break;
          }

          if (status.status === 'failed' || status.status === 'not_found') {
            clearTrackingJob();
            setActiveJobId(null);
            setIsRunning(false);
            setJobStatus(null);
            if (status.status === 'failed') {
              toast.error(t('jobFailed', { reason: status.failedReason ?? t('unknownError') }));
            }
            break;
          }
        } catch {
          // network error, keep polling
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [activeJobId, loadData, t]);

  const handleFilterChange = (newFilters: InsightsFilters) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  const handleRunPrompts = async () => {
    if (!brand) return;
    setIsRunning(true);
    try {
      const { jobId } = await triggerTrackingCheck(brand.id);
      saveTrackingJob({ jobId, brandId: brand.id, startedAt: Date.now() });
      setActiveJobId(jobId);
      setJobStatus({
        status: 'waiting',
        progress: null,
        result: null,
        failedReason: null,
      });
    } catch (err) {
      setIsRunning(false);
      toast.error(err instanceof Error ? err.message : t('triggerFailed'));
    }
  };

  const handleStopTracking = async () => {
    if (!activeJobId) return;
    try {
      await cancelTrackingJob(activeJobId);
    } catch {}
    clearTrackingJob();
    setActiveJobId(null);
    setIsRunning(false);
    setJobStatus(null);
    toast.success(t('trackingStopped'));
    loadData(undefined, { silent: true });
  };

  const handleJobStarted = (jobId: string) => {
    if (!brand) return;
    setIsRunning(true);
    saveTrackingJob({ jobId, brandId: brand.id, startedAt: Date.now() });
    setActiveJobId(jobId);
    setJobStatus({
      status: 'waiting',
      progress: null,
      result: null,
      failedReason: null,
    });
  };

  const handleExportCsv = useCallback(async () => {
    if (!brand) return;
    setIsExporting(true);
    try {
      const f = filtersRef.current;
      const { dateFrom, dateTo } = getDateRange(f.datePreset, {
        from: f.dateFrom,
        to: f.dateTo,
      });
      const filterOpts = {
        model: f.model || undefined,
        region: f.region || undefined,
        topicId: f.topic || undefined,
        dateFrom,
        dateTo,
      };

      const { results: allResults, isCapped } = await exportPromptResults(brand.id, filterOpts);

      const rows: Record<string, string | number>[] = allResults.map((r) => ({
        created_at: r.createdAt,
        prompt: r.promptText,
        topic: r.topicName ?? '',
        platform: PLATFORM_LABELS[r.platform] ?? r.platform,
        model: r.modelUsed ?? '',
        region: r.region ?? '',
        mention_count: r.mentionCount,
        citation_count: r.citationCount,
        visibility_score: r.visibilityScore,
        sentiment: r.sentiment,
        citation_urls: r.citations.map((c) => c.url).join(', '),
        competitor_mentions:
          r.competitorMentions?.map((c) => `${c.name}:${c.mention_count}`).join(', ') ?? '',
      }));

      if (isCapped) {
        rows.push({
          created_at: 'WARNING',
          prompt: 'Export capped at 50,000 rows',
          topic: '',
          platform: '',
          model: '',
          region: '',
          mention_count: 0,
          citation_count: 0,
          visibility_score: 0,
          sentiment: '',
          citation_urls: '',
          competitor_mentions: '',
        });
        toast.warning(t('exportCapped'));
      }

      const csv = toCsv(rows, INSIGHT_EXPORT_HEADERS);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      const slug = brand.slug ?? 'brand';

      link.href = url;
      link.download = `ultravis_${slug}_insights_${date}.csv`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [brand, t]);

  if (!brand || (isLoading && !summary)) return <InsightsSkeleton />;

  const noResults = !summary || summary.totalResults === 0;

  // First load renders the skeleton (summary is still null); once data has
  // ever arrived, a reload from a filter change is a "refetch" — the stale
  // content stays visible under the overlay instead of flashing a skeleton.
  const isRefetching = isLoading && summary !== null;

  // Visibility Rate = prompts the brand appeared in ÷ prompts that produced
  // results, both under the same filters (the Tracked Prompts KPI is the
  // denominator on purpose — the two cards must agree).
  const visibilityRatePct =
    visibilityRate && trackedPrompts && trackedPrompts.activeInPeriod > 0
      ? Math.round((visibilityRate.visiblePrompts / trackedPrompts.activeInPeriod) * 1000) / 10
      : 0;
  const trulyEmpty = noResults && !hasAnyData;

  if (trulyEmpty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{brand.name}</p>
        </div>
        <TrackingProgressBanner jobStatus={jobStatus} onStop={handleStopTracking} />
        <EmptyState
          onRunPrompts={() => setShowRunConfirm(true)}
          isRunning={isRunning}
          isCloud={isCloud}
        />
        <ConfirmRunDialog
          open={showRunConfirm}
          onClose={() => setShowRunConfirm(false)}
          onConfirm={() => {
            setShowRunConfirm(false);
            handleRunPrompts();
          }}
          promptCount={trackedPrompts?.activeInPeriod ?? null}
          isRunning={isRunning}
        />
        {!isCloud && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShowSinglePrompt(true)} className="gap-2">
              <FlaskConical className="h-4 w-4" />
              {t('testSinglePrompt')}
            </Button>
          </div>
        )}
        <RunSinglePromptDialog
          brandId={brand.id}
          open={showSinglePrompt}
          onClose={() => setShowSinglePrompt(false)}
          onJobStarted={handleJobStarted}
        />
      </div>
    );
  }

  const lastCheckedLabel = summary?.lastCheckedAt
    ? formatTimeAgo(new Date(summary.lastCheckedAt), t)
    : t('never');

  const handleResetFilters = () => {
    const resetFilters = { ...DEFAULT_FILTERS };
    setFilters(resetFilters);
    loadData(resetFilters);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

          <p className="text-muted-foreground text-sm">
            {brand.name} · {t('lastRun', { when: lastCheckedLabel })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Self-host only — the primary CTA leads the group (client feedback:
              "Rodar Tudo" was hard to find behind the outline buttons) */}
          {!isCloud && (
            <>
              <Button
                size="lg"
                onClick={() => setShowRunConfirm(true)}
                disabled={isRunning}
                className="gap-2"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t('runAll')}
              </Button>

              <Button variant="outline" onClick={() => setShowSinglePrompt(true)} className="gap-2">
                <FlaskConical className="h-4 w-4" />
                {t('testSingle')}
              </Button>
            </>
          )}

          {/* Always visible */}
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleExportCsv}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? t('exporting') : t('exportCsv')}
          </Button>
        </div>
      </div>

      <ConfirmRunDialog
        open={showRunConfirm}
        onClose={() => setShowRunConfirm(false)}
        onConfirm={() => {
          setShowRunConfirm(false);
          handleRunPrompts();
        }}
        promptCount={trackedPrompts?.activeInPeriod ?? null}
        isRunning={isRunning}
      />

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        availableRegions={availableRegions}
        availableModels={availableModels}
        availableTopics={availableTopics}
      />

      {/* Tracking Progress */}
      <TrackingProgressBanner jobStatus={jobStatus} onStop={handleStopTracking} />

      {/* Refetch overlay: on a filter/date change the previous window's data
          stays mounted (no skeleton — that's first-load only), so without a
          signal the user reads stale numbers as the new period's. Dim the
          content and float a spinner over it; the overlay also swallows
          clicks so a stale card can't be interacted with. The filter bar
          stays outside, so switching presets mid-load keeps working. */}
      <div className="relative">
        {isRefetching && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-background/50 pt-32">
            <div className="flex items-center rounded-md border bg-background p-2.5 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div className={cn('space-y-6', isRefetching && 'opacity-60')}>
          {noResults ? (
            <NoDataForPeriod datePreset={filters.datePreset} onReset={handleResetFilters} />
          ) : (
            <>
              {/* Resumo de visibilidade (reunião 19/ago): três coisas, sem
              nota ponderada — presença "X de N prompts", ranking médio e
              sentimento overall (Igor 42:22: "eu não preciso ter uma nota
              ponderada disso"; 36:40: "não queria ficar com muito número").
              Menções e Citações saíram do resumo — seguem no detalhamento
              e na página Citações. */}
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <KpiCard
                  title={t('presenceTitle')}
                  tooltip={t('visibilityTooltip')}
                  icon={Eye}
                  value={`${visibilityRatePct}%`}
                  sub={t('presenceSub', {
                    visible: visibilityRate?.visiblePrompts ?? 0,
                    total: trackedPrompts?.activeInPeriod ?? 0,
                  })}
                  onClick={() => setBreakdownMetric('visibility')}
                />
                <KpiCard
                  title={t('rankingTitle')}
                  tooltip={t('rankingTooltip')}
                  icon={ListOrdered}
                  value={
                    summary!.rankAvg !== null ? t('rankingValue', { avg: summary!.rankAvg }) : '—'
                  }
                  sub={
                    summary!.rankCount > 0
                      ? t('rankingSub', {
                          r1: summary!.rankDist.r1,
                          r2: summary!.rankDist.r2,
                          r3: summary!.rankDist.r3,
                          r4plus:
                            summary!.rankDist.r4 + summary!.rankDist.r5 + summary!.rankDist.gt5,
                        })
                      : t('rankingEmpty')
                  }
                  onClick={() => router.push('/dashboard/score')}
                />
                <KpiCard
                  title={t('sentimentOverallTitle')}
                  tooltip={t('sentimentOverallTooltip')}
                  icon={AlertCircle}
                  value={
                    summary!.sentPos + summary!.sentNeu + summary!.sentNeg === 0
                      ? '—'
                      : summary!.sentPos > summary!.sentNeg
                        ? t('sentimentPositive')
                        : summary!.sentNeg > summary!.sentPos
                          ? t('sentimentNegative')
                          : t('sentimentNeutral')
                  }
                  sub={t('sentimentCounts', {
                    pos: summary!.sentPos,
                    neu: summary!.sentNeu,
                    neg: summary!.sentNeg,
                  })}
                  subVariant={summary!.sentPos > summary!.sentNeg ? 'positive' : 'muted'}
                />
                <KpiCard
                  title={t('trackedPromptsTitle')}
                  tooltip={t('trackedTooltip')}
                  icon={Layers}
                  value={trackedPrompts?.activeInPeriod ?? 0}
                  sub={
                    trackedPrompts && trackedPrompts.quotaLimit !== -1 ? (
                      <>
                        <span className="tabular-nums">
                          {trackedPrompts.quotaUsed} / {trackedPrompts.quotaLimit} prompts
                        </span>
                        {trackedPrompts.quotaUsed >= trackedPrompts.quotaLimit * 0.9 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push('/dashboard/settings');
                            }}
                            className="ml-1 underline underline-offset-2 hover:text-foreground"
                          >
                            {t('upgrade')}
                          </button>
                        )}
                      </>
                    ) : (
                      t('promptsTracked', { count: trackedPrompts?.quotaUsed ?? 0 })
                    )
                  }
                  onClick={() => router.push('/dashboard/prompts')}
                />
              </div>

              {/* Competitor Comparison */}
              {competitorData ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                  <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4" />
                        {t('brandVsCompetitors')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CompetitorChart
                        providerRows={competitorData.providerRows}
                        brands={competitorData.brands}
                      />
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-sm font-medium">{t('leaderboard')}</CardTitle>
                        <Link
                          href="/dashboard/competitors"
                          className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {t('headToHead')}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CompetitorLeaderboard data={competitorData.brands} />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <NoCompetitorsTeaser />
              )}

              {/* Share of Voice */}
              {sovData && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <PieChart className="h-4 w-4" />
                        {t('sovByPlatform')}
                        <InfoTip content={t('sovTooltip')} />
                      </CardTitle>
                      {sovData.overallSovChange !== null && sovData.overallSovChange !== 0 && (
                        <DeltaBadge delta={sovData.overallSovChange} suffix=" pts" />
                      )}
                    </CardHeader>
                    <CardContent>
                      <ShareOfVoicePlatformChart
                        data={sovData.byPlatform}
                        overallSov={sovData.overallSov}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <TrendingUp className="h-4 w-4" />
                        {t('sovTrendTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ShareOfVoiceTrendChart data={sovData.trend} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Single Prompt Runner */}
      <RunSinglePromptDialog
        brandId={brand.id}
        open={showSinglePrompt}
        onClose={() => setShowSinglePrompt(false)}
        onJobStarted={handleJobStarted}
      />

      {/* Metric Breakdown Drilldown */}
      <MetricBreakdownSheet
        brandId={brand.id}
        metric={breakdownMetric}
        onOpenChange={(open) => {
          if (!open) setBreakdownMetric(null);
        }}
        filters={(() => {
          const { dateFrom, dateTo } = getDateRange(filters.datePreset, {
            from: filters.dateFrom,
            to: filters.dateTo,
          });
          return {
            dateFrom,
            dateTo,
            region: filters.region || undefined,
            model: filters.model || undefined,
            topicId: filters.topic || undefined,
          };
        })()}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date, t: ReturnType<typeof useTranslations>): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { count: days });
}
