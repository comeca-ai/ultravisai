'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Score de Visibilidade — o índice de RESULTADO da arquitetura de dois
 * índices (docs de lógica de 17/ago): lido das respostas de IA. O Índice de
 * Citabilidade é a alavanca que o dirige; os dois nunca se somam, e a página
 * declara isso logo no topo.
 *
 * v1: Citação, Presença, Posição e Sentimento medidos das respostas
 * (`resultScore` na action do índice — mesmo scan, sem custo extra);
 * Autoridade e Acurácia exigem juiz LLM e entram DECLARADAS "em construção",
 * com os pesos renormalizados sobre o que é medido (mesmo padrão do IC).
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBrandStore } from '@/stores/use-brand-store';
import {
  getVisibilityIndex,
  type VisibilityIndexData,
  type VisibilityIndexPreset,
} from '@/lib/actions/visibility-index';
import { SCORE_DIMENSIONS, type ScoreDimKey } from '@/config/visibility-score';
import { indexScoreBand } from '@/config/visibility-index';
import { cn } from '@/lib/utils';

const SCORE_ACCENT = '#2a78d6';

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

export default function VisibilityScorePage() {
  const t = useTranslations('visibilityScore');
  const locale = useLocale();
  const activeBrandId = useBrandStore((s) => s.activeBrandId);
  const [preset, setPreset] = useState<VisibilityIndexPreset>('30d');
  const [data, setData] = useState<VisibilityIndexData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBrandId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const indexData = await getVisibilityIndex(activeBrandId, preset);
        if (!cancelled) setData(indexData);
      } catch (err) {
        console.error('Failed to load visibility score:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId, preset]);

  // Nota por dimensão (null = não medida nesta janela / mecanismo pendente).
  const dimScores = useMemo(() => {
    if (!data) return null;
    const rs = data.resultScore;
    const map: Record<ScoreDimKey, number | null> = {
      citation: rs.citation,
      presence: rs.presence,
      authority: null,
      position: rs.position.score,
      accuracy: null,
      sentiment: rs.sentiment.score,
    };
    return map;
  }, [data]);

  // Score = média ponderada sobre as dimensões medidas (pesos renormalizados).
  const score = useMemo(() => {
    if (!dimScores) return null;
    const parts = SCORE_DIMENSIONS.flatMap((dim) => {
      const s = dimScores[dim.key];
      return s === null ? [] : [{ key: dim.key, weight: dim.weight, score: s }];
    });
    if (parts.length === 0) return null;
    const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
    const value = Math.round(parts.reduce((s, p) => s + p.score * (p.weight / totalWeight), 0));
    return { value, parts, totalWeight };
  }, [dimScores]);

  const dec = locale === 'en' ? '.' : ',';
  const formula = useMemo(() => {
    if (!score) return '';
    const terms = score.parts.map((p) => `0${dec}${String(p.weight).padStart(2, '0')}×${p.score}`);
    return `${terms.join(' + ')} = ${score.value}`;
  }, [score, dec]);

  const hasData = (data?.totals.results ?? 0) > 0;
  const rs = data?.resultScore ?? null;

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

      {/* Dois índices, uma frase — resultado vs alavanca */}
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('twoIndexNote')}{' '}
        <Link href="/dashboard/citability" className="font-medium underline underline-offset-2">
          {t('twoIndexLink')}
        </Link>
      </div>

      {/* Hero */}
      <Card className="overflow-hidden border-primary/20">
        <div className="border-l-4" style={{ borderColor: SCORE_ACCENT }}>
          <CardContent className="flex flex-wrap gap-8 p-6">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : !hasData || score === null ? (
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
                      {score.value}
                      <span className="text-base font-normal text-muted-foreground">/100</span>
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', BAND_CLASSES[indexScoreBand(score.value)])}
                    >
                      {t(`bands.${indexScoreBand(score.value)}`)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('hero.sample', { results: data?.totals.results ?? 0 })}
                  </p>
                </div>
                <div className="min-w-[260px] flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('hero.formulaLabel')}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm">{formula}</p>
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    {t('hero.renormNote')}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Dimension cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SCORE_DIMENSIONS.map((dim) => {
          const s = dimScores?.[dim.key] ?? null;
          return (
            <Card key={dim.key} className="flex flex-col overflow-hidden">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="font-bold" style={{ color: SCORE_ACCENT }}>
                        {dim.n}
                      </span>
                      {t(`dims.${dim.key}.name`)}
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {t('dims.weight', { weight: dim.weight })}
                      </Badge>
                    </CardTitle>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t(`dims.${dim.key}.brief`)}
                    </p>
                  </div>
                  {loading ? (
                    <Skeleton className="h-9 w-16" />
                  ) : s === null ? (
                    <span className="text-sm font-medium italic text-muted-foreground">
                      {dim.measured ? t('dims.noSample') : t('dims.building')}
                    </span>
                  ) : (
                    <span className={cn('text-3xl font-bold tabular-nums', scoreColorClass(s))}>
                      {s}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </span>
                  )}
                </div>
                {s !== null && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full', scoreBarClass(s))} style={{ width: `${s}%` }} />
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2 pt-0 text-xs text-muted-foreground">
                {!dim.measured ? (
                  <p className="italic">{t(`dims.${dim.key}.buildingNote`)}</p>
                ) : (
                  <ul className="space-y-1">
                    {dim.key === 'citation' && data && (
                      <li>
                        {t('dims.citation.ev', {
                          citing: data.d2.resultsCitingOwn,
                          total: data.totals.results,
                          pct: data.d2.pctOwn,
                        })}
                      </li>
                    )}
                    {dim.key === 'presence' && data && (
                      <li>
                        {t('dims.presence.ev', {
                          mentioned: data.share.mentioned,
                          total: data.share.total,
                        })}
                      </li>
                    )}
                    {dim.key === 'position' &&
                      rs &&
                      (rs.position.score !== null ? (
                        <li>{t('dims.position.ev', { samples: rs.position.samples })}</li>
                      ) : (
                        <li className="italic">{t('dims.position.noSample')}</li>
                      ))}
                    {dim.key === 'sentiment' &&
                      rs &&
                      (rs.sentiment.score !== null ? (
                        <li>
                          {t('dims.sentiment.ev', {
                            pos: rs.sentiment.pos,
                            neu: rs.sentiment.neu,
                            neg: rs.sentiment.neg,
                          })}
                        </li>
                      ) : (
                        <li className="italic">{t('dims.sentiment.noSample')}</li>
                      ))}
                    <li className="italic">{t(`dims.${dim.key}.how`)}</li>
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Próximo passo da arquitetura */}
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t('gapNote')}{' '}
        <Link
          href="/dashboard/citability"
          className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
        >
          {t('gapLink')} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
