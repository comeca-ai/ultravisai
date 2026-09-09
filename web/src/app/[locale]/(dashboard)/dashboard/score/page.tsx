'use client';

/**
 * Ultravis addition (fork layer — additive page, no core changes).
 *
 * Score de Visibilidade — o índice de RESULTADO da arquitetura de dois
 * índices (docs de lógica de 17/ago): lido das respostas de IA. O Índice de
 * Citabilidade é a alavanca que o dirige; os dois nunca se somam, e a página
 * declara isso logo no topo.
 *
 * v1: Leitura (ex-Citação), Presença, Ranking (ex-Posição) e Sentimento —
 * renomes da reunião de 19/ago, só nos rótulos i18n — medidos das respostas
 * (`resultScore` na action do índice — mesmo scan, sem custo extra).
 * Autoridade e Acurácia SAÍRAM do Score por decisão do dono (19/ago) até o
 * juiz LLM existir — pesos renormalizados sobre as 4 dimensões medidas.
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
import { PLATFORM_LABELS } from '@/config/platform-labels';
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
      position: rs.position.score,
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
  // A conta impressa usa os pesos EFETIVOS (renormalizados sobre as dimensões
  // medidas), não os brutos do registro — senão a equação não soma o valor
  // exibido (revisão 29/ago: 0,20×31+0,20×48+0,15×57+0,10×64 = 30,75 ≠ 47).
  // Com coeficientes arredondados a 2 casas, usa ≈ quando a soma não bate exata.
  const formula = useMemo(() => {
    if (!score) return '';
    const coeffs = score.parts.map((p) => Math.round((p.weight / score.totalWeight) * 100) / 100);
    const terms = coeffs.map((c, i) => `${c.toFixed(2).replace('.', dec)}×${score.parts[i].score}`);
    const printedSum = coeffs.reduce((s, c, i) => s + c * score.parts[i].score, 0);
    const sign = Math.round(printedSum) === score.value ? '=' : '≈';
    return `${terms.join(' + ')} ${sign} ${score.value}`;
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
          {(['24h', '7d', '30d', '90d', 'all'] as VisibilityIndexPreset[]).map((p) => (
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
      <div className="grid gap-4 md:grid-cols-2">
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
                      {t('dims.noSample')}
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
                {
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
                        <>
                          <li>{t('dims.position.ev', { samples: rs.position.samples })}</li>
                          {/* O número que o cliente entende (#2,3) ao lado do que
                              entra na conta — os dois vêm do mesmo RPC, então a
                              tela de Insights mostra exatamente este valor. */}
                          {rs.position.avg !== null && (
                            <li>{t('dims.position.avg', { avg: rs.position.avg })}</li>
                          )}
                          {rs.position.semRival > 0 && (
                            <li className="text-muted-foreground">
                              {t('dims.position.semRival', { count: rs.position.semRival })}
                            </li>
                          )}
                          {/* Distribuição da premissa de 18/ago: 1º/2º/3º/4º+ por ordem de aparição. */}
                          <li>
                            <span className="mt-1 flex flex-col gap-1">
                              {(
                                [
                                  ['p1', rs.position.dist.p1, 'bg-emerald-500'],
                                  ['p2', rs.position.dist.p2, 'bg-lime-500'],
                                  ['p3', rs.position.dist.p3, 'bg-amber-500'],
                                  ['p4', rs.position.dist.p4, 'bg-red-500'],
                                ] as const
                              ).map(([key, count, color]) => {
                                const pctVal = Math.round((count / rs.position.samples) * 100);
                                return (
                                  <span key={key} className="flex items-center gap-2">
                                    <span className="w-16 shrink-0 text-[11px]">
                                      {t(`dims.position.${key}`)}
                                    </span>
                                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                      <span
                                        className={cn('block h-full', color)}
                                        style={{ width: `${pctVal}%` }}
                                      />
                                    </span>
                                    <span className="w-14 shrink-0 text-right tabular-nums text-[11px]">
                                      {pctVal}% ({count})
                                    </span>
                                  </span>
                                );
                              })}
                            </span>
                          </li>
                        </>
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
                }
                {/* Fontes pesquisadas do Sentimento: placar por motor (19/ago). */}
                {dim.key === 'sentiment' && rs && rs.sentiment.byPlatform.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <p className="mb-1.5 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                      {t('dims.sentiment.sourcesLabel')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rs.sentiment.byPlatform.map((p) => (
                        <span
                          key={p.platform}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] tabular-nums"
                        >
                          <span>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            +{p.pos}
                          </span>
                          <span className="text-muted-foreground">~{p.neu}</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            −{p.neg}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Onde falam de você: domínios citados nas respostas com a
                    marca, com o sentimento da resposta (Igor 51:28, 19/ago). */}
                {dim.key === 'sentiment' && rs && rs.sentiment.topSources.length > 0 && (
                  <div className="rounded-md border bg-muted/30 p-2.5">
                    <p className="mb-1.5 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                      {t('dims.sentiment.domainsLabel')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rs.sentiment.topSources.map((s) => (
                        <span
                          key={s.domain}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] tabular-nums"
                        >
                          <span className="max-w-[160px] truncate">{s.domain}</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            +{s.pos}
                          </span>
                          <span className="text-muted-foreground">~{s.neu}</span>
                          <span className="font-medium text-red-600 dark:text-red-400">
                            −{s.neg}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
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
