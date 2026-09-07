'use client';

/**
 * Insights v3 (mockup do dono, 19/ago) — as três seções novas da tela:
 * funil da citação, scatter Menção × Citação e cards "Próxima ação".
 * Layout do mockup, design system do fork (tokens/tema atuais — a paleta
 * própria do mockup é item separado do BACKLOG). Toda leitura numérica vem
 * de dados reais; o que é sugestão (metas dos cards) declara proveniência.
 */

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  classifyBrands,
  deriveNextActions,
  extractEngineGap,
  funnelRates,
  funnelWidths,
  sqrtPosition,
  type FunnelCounts,
  type NextAction,
  type QuadrantKey,
  type ScatterBrand,
} from './insights-v3-logic';
import type { CompetitorComparisonData } from '@/lib/actions/tracking';

// ─── Funil da citação ────────────────────────────────────────────────────────

export function CitationFunnelCard({ funnel }: { funnel: FunnelCounts }) {
  const t = useTranslations('insights');
  const rates = funnelRates(funnel);
  const widths = funnelWidths(funnel);
  const stages: Array<{ label: string; value: number; conv: number | null }> = [
    { label: t('v3FunnelStageExecutions'), value: funnel.executions, conv: rates.groundedPct },
    { label: t('v3FunnelStageGrounded'), value: funnel.grounded, conv: rates.marketPct },
    { label: t('v3FunnelStageMarket'), value: funnel.marketCited, conv: rates.brandOfMarketPct },
    { label: t('v3FunnelStageBrand'), value: funnel.brandCited, conv: null },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('v3FunnelTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('v3FunnelSub')}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stages.map((stage, i) => (
            <div key={stage.label} className="space-y-1">
              <div className="h-2 w-full rounded bg-muted">
                <div
                  className={cn('h-2 rounded', i === 3 ? 'bg-primary' : 'bg-foreground/50')}
                  style={{ width: `${widths[i]}%` }}
                />
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {stage.value.toLocaleString()}
              </div>
              <div className="text-xs leading-tight text-muted-foreground">{stage.label}</div>
              {stage.conv !== null && (
                <div className="text-xs font-medium tabular-nums text-muted-foreground">
                  {t('v3FunnelConv', { pct: stage.conv })}
                </div>
              )}
            </div>
          ))}
        </div>
        {funnel.marketCited > 0 && (
          <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">
            {t('v3FunnelRead', {
              share: rates.brandOfMarketPct,
              brandCited: funnel.brandCited,
              marketCited: funnel.marketCited,
              grounded: rates.brandOfGroundedPct,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Scatter Menção × Citação ────────────────────────────────────────────────

const QUADRANT_BADGE_CLASS: Record<QuadrantKey, string> = {
  borrowed: 'bg-destructive/10 text-destructive border-destructive/30',
  own: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  invisible: 'bg-muted text-muted-foreground border-border',
  lost: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

function quadrantLabel(t: ReturnType<typeof useTranslations>, q: QuadrantKey): string {
  return t(`v3Quadrant_${q}`);
}

const PLOT = { width: 740, height: 400, padLeft: 64, padRight: 20, padTop: 26, padBottom: 44 };

export function CompetitiveScatterCard({ data }: { data: CompetitorComparisonData }) {
  const t = useTranslations('insights');

  const brands: ScatterBrand[] = data.brands.map((b) => ({
    name: b.name,
    mentions: b.totalMentions,
    citations: b.totalCitations,
    presence: b.visibilityRate,
    isOwnBrand: b.isOwnBrand,
  }));
  const classified = classifyBrands(brands);
  if (classified.length < 2) return null;

  const maxMentions = Math.max(...classified.map((b) => b.mentions));
  const maxCitations = Math.max(...classified.map((b) => b.citations));
  const maxPresence = Math.max(...classified.map((b) => b.presence), 1);
  const innerW = PLOT.width - PLOT.padLeft - PLOT.padRight;
  const innerH = PLOT.height - PLOT.padTop - PLOT.padBottom;
  const avgMentions = brands.reduce((s, b) => s + b.mentions, 0) / brands.length;
  const avgCitations = brands.reduce((s, b) => s + b.citations, 0) / brands.length;

  const x = (citations: number) => PLOT.padLeft + sqrtPosition(citations, maxCitations) * innerW;
  const y = (mentions: number) =>
    PLOT.padTop + innerH - sqrtPosition(mentions, maxMentions) * innerH;
  const splitX = x(avgCitations);
  const splitY = y(avgMentions);
  const radius = (presence: number) => 7 + (presence / maxPresence) * 14;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('v3ScatterTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('v3ScatterSub')}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
              className="h-auto w-full min-w-[560px]"
              role="img"
              aria-label={t('v3ScatterTitle')}
            >
              {/* divisores dos quadrantes (média do conjunto em cada eixo) */}
              <line
                x1={splitX}
                y1={PLOT.padTop}
                x2={splitX}
                y2={PLOT.padTop + innerH}
                className="stroke-border"
                strokeDasharray="4 4"
              />
              <line
                x1={PLOT.padLeft}
                y1={splitY}
                x2={PLOT.padLeft + innerW}
                y2={splitY}
                className="stroke-border"
                strokeDasharray="4 4"
              />
              {/* eixos */}
              <line
                x1={PLOT.padLeft}
                y1={PLOT.padTop + innerH}
                x2={PLOT.padLeft + innerW}
                y2={PLOT.padTop + innerH}
                className="stroke-muted-foreground/60"
              />
              <line
                x1={PLOT.padLeft}
                y1={PLOT.padTop}
                x2={PLOT.padLeft}
                y2={PLOT.padTop + innerH}
                className="stroke-muted-foreground/60"
              />
              {/* rótulos dos quadrantes */}
              <text
                x={PLOT.padLeft + 8}
                y={PLOT.padTop + 14}
                className="fill-destructive text-[10px] uppercase tracking-wider"
              >
                {quadrantLabel(t, 'borrowed')}
              </text>
              <text
                x={PLOT.padLeft + innerW - 8}
                y={PLOT.padTop + 14}
                textAnchor="end"
                className="fill-emerald-600 text-[10px] uppercase tracking-wider"
              >
                {quadrantLabel(t, 'own')}
              </text>
              <text
                x={PLOT.padLeft + 8}
                y={PLOT.padTop + innerH - 8}
                className="fill-muted-foreground text-[10px] uppercase tracking-wider"
              >
                {quadrantLabel(t, 'invisible')}
              </text>
              <text
                x={PLOT.padLeft + innerW - 8}
                y={PLOT.padTop + innerH - 8}
                textAnchor="end"
                className="fill-amber-600 text-[10px] uppercase tracking-wider"
              >
                {quadrantLabel(t, 'lost')}
              </text>
              {/* títulos dos eixos */}
              <text
                x={PLOT.padLeft + innerW / 2}
                y={PLOT.height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] uppercase tracking-wider"
              >
                {t('v3ScatterAxisX')}
              </text>
              <text
                x={16}
                y={PLOT.padTop + innerH / 2}
                textAnchor="middle"
                transform={`rotate(-90 16 ${PLOT.padTop + innerH / 2})`}
                className="fill-muted-foreground text-[10px] uppercase tracking-wider"
              >
                {t('v3ScatterAxisY')}
              </text>
              {/* bolhas — a própria marca por último (fica por cima) */}
              {[...classified]
                .sort((a, b) => Number(a.isOwnBrand) - Number(b.isOwnBrand))
                .map((b) => (
                  <g key={b.name}>
                    <circle
                      cx={x(b.citations)}
                      cy={y(b.mentions)}
                      r={radius(b.presence)}
                      className={
                        b.isOwnBrand ? 'fill-primary stroke-foreground' : 'fill-muted-foreground/50'
                      }
                      strokeWidth={b.isOwnBrand ? 2 : 0}
                    />
                    <text
                      x={x(b.citations) + radius(b.presence) + 5}
                      y={y(b.mentions) + 4}
                      className={cn(
                        'text-[11px]',
                        b.isOwnBrand ? 'fill-foreground font-semibold' : 'fill-muted-foreground',
                      )}
                    >
                      {b.name}
                    </text>
                  </g>
                ))}
            </svg>
          </div>

          {/* legenda: diagnóstico por marca */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('v3ScatterLegendTitle')}
            </div>
            {classified
              .slice()
              .sort((a, b) => Number(b.isOwnBrand) - Number(a.isOwnBrand))
              .map((b) => (
                <div
                  key={b.name}
                  className={cn(
                    'rounded-md border p-2',
                    b.isOwnBrand ? 'border-primary/40 bg-primary/5' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">{b.name}</span>
                    {b.isOwnBrand && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t('youBadge')}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-auto shrink-0 text-[10px]',
                        QUADRANT_BADGE_CLASS[b.quadrant],
                      )}
                    >
                      {quadrantLabel(t, b.quadrant)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {t('v3ScatterLegendNums', {
                      mentions: b.mentions,
                      citations: b.citations,
                      presence: b.presence,
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Próxima ação ────────────────────────────────────────────────────────────

export function NextActionCards({
  funnel,
  competitorData,
  visiblePrompts,
  promptCount,
}: {
  funnel: FunnelCounts | null;
  competitorData: CompetitorComparisonData;
  visiblePrompts: number;
  promptCount: number;
}) {
  const t = useTranslations('insights');
  const own = competitorData.brands.find((b) => b.isOwnBrand);
  if (!own) return null;

  const actions = deriveNextActions({
    funnel,
    ownMentions: own.totalMentions,
    ownCitations: own.totalCitations,
    presencePct: own.visibilityRate,
    visiblePrompts,
    promptCount,
    engineGap: extractEngineGap(
      competitorData.providerRows as Array<Record<string, string | number>>,
      own.name,
    ),
  });
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('v3ActionsTitle')}</CardTitle>
        <p className="text-xs text-muted-foreground">{t('v3ActionsSub')}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action) => (
            <NextActionCard key={action.key} action={action} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{t('v3ActionsProvenance')}</p>
      </CardContent>
    </Card>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  const t = useTranslations('insights');
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border p-4',
        action.hot ? 'border-primary bg-primary/5' : 'border-border',
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {t(`v3Action_${action.key}_lever`)}
      </span>
      <div className="mt-1 font-semibold">{t(`v3Action_${action.key}_title`)}</div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">
        {t(`v3Action_${action.key}_desc`, action.params)}
      </p>
      <div className="mt-3 flex items-baseline gap-2 border-t pt-2 text-sm tabular-nums">
        <span className="text-muted-foreground">{action.goalFrom}</span>
        <span className="font-semibold text-primary">→ {action.goalTo}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {t(`v3Action_${action.key}_metric`)}
        </span>
      </div>
    </div>
  );
}
