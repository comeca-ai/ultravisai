/**
 * Ultravis addition (fork layer — additive file).
 *
 * Índice de Visibilidade — dimension weights and zone mapping.
 * Canonical framework: `estrategia/indice-citabilidade.md`. Weights are kept
 * here (not inlined in the page) so recalibration — expected after the
 * framework owner's logic document — is a one-file change.
 */

export type IndexZone = 'A' | 'B' | 'C';

export const INDEX_ZONE_COLORS: Record<IndexZone, string> = {
  A: '#2a78d6',
  B: '#eb6834',
  C: '#1baf7a',
};

export type IndexDimKey = 'dim1' | 'dim2' | 'dim3' | 'dim4' | 'dim5' | 'dim6';

export interface IndexDimension {
  n: string;
  key: IndexDimKey;
  /** Percent weight in the index — must sum to 100 across dimensions. */
  weight: number;
  zone: IndexZone;
  /** Where the card's CTA leads. */
  ctaHref: string;
}

export const INDEX_DIMENSIONS: IndexDimension[] = [
  { n: '01', key: 'dim1', weight: 15, zone: 'A', ctaHref: '/dashboard/audit' },
  { n: '02', key: 'dim2', weight: 20, zone: 'A', ctaHref: '/dashboard/content' },
  { n: '03', key: 'dim3', weight: 12, zone: 'B', ctaHref: '/dashboard/citations' },
  { n: '04', key: 'dim4', weight: 18, zone: 'B', ctaHref: '/dashboard/citations' },
  { n: '05', key: 'dim5', weight: 22, zone: 'C', ctaHref: '/dashboard/citations' },
  { n: '06', key: 'dim6', weight: 13, zone: 'C', ctaHref: '/dashboard/citations' },
];

export const INDEX_ZONES: IndexZone[] = ['A', 'B', 'C'];

/** Below this many citations in a category the score is directional only. */
export const INDEX_LOW_SAMPLE_THRESHOLD = 10;

/** Score bands (faixas) — requested by the pilot client (10/ago doc). */
export const INDEX_SCORE_BANDS = [
  { max: 30, key: 'undesirable' },
  { max: 50, key: 'regular' },
  { max: 70, key: 'good' },
  { max: 90, key: 'great' },
  { max: 100, key: 'best' },
] as const;

export type IndexBandKey = (typeof INDEX_SCORE_BANDS)[number]['key'];

export function indexScoreBand(score: number): IndexBandKey {
  const band = INDEX_SCORE_BANDS.find((b) => score <= b.max);
  return (band ?? INDEX_SCORE_BANDS[INDEX_SCORE_BANDS.length - 1]).key;
}
