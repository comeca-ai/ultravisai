'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Admin cost & consumption monitor. Everything countable comes live from
 * the database via getAdminUsage (RLS-scoped); dollar figures are
 * estimates computed here from response sizes and the unit prices in
 * PRICING — always labeled as estimates. The provider consoles remain the
 * source of truth for billing; this page exists so the operator sees the
 * consumption shape without leaving the product.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CircleDollarSign, Quote, Sparkles, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminUsage, type AdminUsage } from '@/lib/actions/admin-usage';

// ─── Estimation constants (US$ per million tokens; chars→tokens ratio) ──────

const PRICING = {
  charsPerToken: 3.6,
  claudeSonnetIn: 3,
  claudeSonnetOut: 15,
  gptMiniIn: 0.25,
  gptMiniOut: 2,
  /** Assumed prompt-side tokens per tracking/sentiment call. */
  trackingInputTokens: 300,
  sentimentPromptTokens: 400,
  sentimentOutputTokens: 60,
};

function estimateCosts(u: AdminUsage) {
  const M = 1_000_000;
  const trackingOutTokens = u.claudeApiChars / PRICING.charsPerToken;
  const anthropicTracking =
    (u.claudeApiResults * PRICING.trackingInputTokens * PRICING.claudeSonnetIn) / M +
    (trackingOutTokens * PRICING.claudeSonnetOut) / M;
  const agent =
    (u.agentPromptTokens * PRICING.claudeSonnetIn) / M +
    (u.agentCompletionTokens * PRICING.claudeSonnetOut) / M;
  const sentimentInTokens =
    u.sentimentRuns * (u.avgSentimentChars / PRICING.charsPerToken + PRICING.sentimentPromptTokens);
  const openai =
    (sentimentInTokens * PRICING.gptMiniIn) / M +
    (u.sentimentRuns * PRICING.sentimentOutputTokens * PRICING.gptMiniOut) / M;
  return {
    anthropic: anthropicTracking + agent,
    openai,
    total: anthropicTracking + agent + openai,
    trackingOutTokens: Math.round(trackingOutTokens),
    trackingInTokens: u.claudeApiResults * PRICING.trackingInputTokens,
    sentimentInTokens: Math.round(sentimentInTokens),
  };
}

const usd = (v: number) =>
  v < 0.005 && v > 0 ? '< US$ 0,01' : `US$ ${v.toFixed(2).replace('.', ',')}`;

// ─── Small pieces ────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  loading,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'border-primary/40' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <div className="text-3xl font-bold tabular-nums">{value}</div>
        )}
        <p className="text-xs mt-1 text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function BarList({ rows }: { rows: { key: string; count: number }[] }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
          <span className="truncate text-right text-xs text-muted-foreground" title={row.key}>
            {row.key}
          </span>
          <div className="h-3.5 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary/80"
              style={{ width: `${Math.max(3, (row.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

type ChipTone = 'measured' | 'estimated' | 'free';

function StatusChip({ tone, label }: { tone: ChipTone; label: string }) {
  const classes: Record<ChipTone, string> = {
    measured: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    estimated: 'border-primary/40 bg-primary/10 text-primary',
    free: 'text-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium whitespace-nowrap ${classes[tone]}`}
    >
      {label}
    </Badge>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminCostsPage() {
  const t = useTranslations('adminCosts');
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminUsage();
        if (!cancelled) setUsage(data);
      } catch (err) {
        console.error('Failed to load admin usage:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const costs = useMemo(() => (usage ? estimateCosts(usage) : null), [usage]);

  const lastUpdated = usage?.lastResultAt
    ? new Date(usage.lastResultAt).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{t('subtitle')}</p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground">{t('lastData', { date: lastUpdated })}</p>
        )}
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          accent
          title={t('kpis.llmSpend')}
          value={costs ? `≈ ${usd(costs.total)}` : '—'}
          sub={t('kpis.llmSpendSub')}
          icon={CircleDollarSign}
          loading={loading}
        />
        <KpiCard
          title={t('kpis.cloroCredits')}
          value={usage ? `${usage.cloroScrapes}` : '—'}
          sub={t('kpis.cloroCreditsSub')}
          icon={Quote}
          loading={loading}
        />
        <KpiCard
          title={t('kpis.results')}
          value={usage ? `${usage.totalResults}` : '—'}
          sub={
            usage
              ? t('kpis.resultsSub', { cloro: usage.cloroScrapes, api: usage.claudeApiResults })
              : ''
          }
          icon={Activity}
          loading={loading}
        />
        <KpiCard
          title={t('kpis.sentiment')}
          value={usage ? `${usage.sentimentRuns}` : '—'}
          sub={t('kpis.sentimentSub')}
          icon={Sparkles}
          loading={loading}
        />
      </div>

      {/* Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('byPlatform')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarList rows={usage?.byPlatform ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('byBrand')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {usage ? t('byBrandSub', { brands: usage.brands, prompts: usage.activePrompts }) : ''}
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <BarList rows={usage?.byBrand ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('providers.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('providers.subtitle')}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t('providers.provider')}</th>
                <th className="py-2 pr-3 font-medium">{t('providers.what')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('providers.volume')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('providers.tokens')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('providers.cost')}</th>
                <th className="py-2 font-medium">{t('providers.status')}</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              <tr className="border-b">
                <td className="py-2.5 pr-3 font-semibold">Cloro</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t('providers.cloroDesc')}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {usage ? t('providers.credits', { count: usage.cloroScrapes }) : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right">—</td>
                <td className="py-2.5 pr-3 text-right">{t('providers.cloroCost')}</td>
                <td className="py-2.5">
                  <StatusChip tone="measured" label={t('providers.measured')} />
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2.5 pr-3 font-semibold">Anthropic</td>
                <td className="py-2.5 pr-3 text-muted-foreground">
                  {t('providers.anthropicDesc')}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {usage
                    ? t('providers.calls', {
                        count: usage.claudeApiResults,
                      })
                    : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {costs
                    ? `${Math.round((costs.trackingInTokens + usage!.agentPromptTokens) / 1000)}k / ${Math.round((costs.trackingOutTokens + usage!.agentCompletionTokens) / 1000)}k`
                    : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {costs ? `≈ ${usd(costs.anthropic)}` : '—'}
                </td>
                <td className="py-2.5">
                  <StatusChip tone="estimated" label={t('providers.estimated')} />
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2.5 pr-3 font-semibold">OpenAI</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t('providers.openaiDesc')}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {usage ? t('providers.calls', { count: usage.sentimentRuns }) : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {costs
                    ? `${Math.round(costs.sentimentInTokens / 1000)}k / ${usage ? Math.round((usage.sentimentRuns * PRICING.sentimentOutputTokens) / 1000) : 0}k`
                    : '—'}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums">
                  {costs ? `≈ ${usd(costs.openai)}` : '—'}
                </td>
                <td className="py-2.5">
                  <StatusChip tone="estimated" label={t('providers.estimated')} />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-semibold">Gemini</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{t('providers.geminiDesc')}</td>
                <td className="py-2.5 pr-3 text-right">—</td>
                <td className="py-2.5 pr-3 text-right">—</td>
                <td className="py-2.5 pr-3 text-right">US$ 0,00</td>
                <td className="py-2.5">
                  <StatusChip tone="free" label={t('providers.freeTier')} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Where the exact numbers live + assumptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('notes.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-xs text-muted-foreground md:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-foreground">{t('notes.exactTitle')}</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>{t('notes.exactAnthropic')}</li>
              <li>{t('notes.exactOpenai')}</li>
              <li>{t('notes.exactGemini')}</li>
              <li>{t('notes.exactCloro')}</li>
              <li>{t('notes.exactRailway')}</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground">{t('notes.assumptionsTitle')}</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>{t('notes.assumptionTokens')}</li>
              <li>{t('notes.assumptionPrices')}</li>
              <li>{t('notes.assumptionSource')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
