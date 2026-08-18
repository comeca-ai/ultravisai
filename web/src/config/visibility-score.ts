/**
 * Ultravis addition (fork layer).
 *
 * Score de Visibilidade — o índice de RESULTADO da arquitetura de dois
 * índices (docs de lógica de 17/ago): lido das respostas de IA, dirigido
 * pelo Índice de Citabilidade (alavanca). Os dois NUNCA se somam.
 *
 * Dimensões e pesos do registro (PPT slide 8): Citação 20 · Presença 20 ·
 * Autoridade 20 · Posição 15 · Acurácia 15 · Sentimento 10. Autoridade e
 * Acurácia exigem juiz LLM (piloto futuro) — entram DECLARADAS como "em
 * construção" e os pesos são renormalizados sobre as dimensões medidas,
 * mesmo padrão do IC quando falta o D1.
 *
 * As faixas de nota são os mesmos quintis do IC
 * (`INDEX_SCORE_BANDS`/`indexScoreBand` em visibility-index.ts).
 */

export type ScoreDimKey =
  | 'citation'
  | 'presence'
  | 'authority'
  | 'position'
  | 'accuracy'
  | 'sentiment';

export interface ScoreDimension {
  key: ScoreDimKey;
  n: string;
  /** Peso % do registro (soma 100). */
  weight: number;
  /** false = ainda sem mecanismo de medição (juiz LLM) — declarado na UI. */
  measured: boolean;
}

export const SCORE_DIMENSIONS: ScoreDimension[] = [
  { key: 'citation', n: '01', weight: 20, measured: true },
  { key: 'presence', n: '02', weight: 20, measured: true },
  { key: 'authority', n: '03', weight: 20, measured: false },
  { key: 'position', n: '04', weight: 15, measured: true },
  { key: 'accuracy', n: '05', weight: 15, measured: false },
  { key: 'sentiment', n: '06', weight: 10, measured: true },
];
