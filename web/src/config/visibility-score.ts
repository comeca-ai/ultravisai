/**
 * Ultravis addition (fork layer).
 *
 * Score de Visibilidade — o índice de RESULTADO da arquitetura de dois
 * índices (docs de lógica de 17/ago): lido das respostas de IA, dirigido
 * pelo Índice de Citabilidade (alavanca). Os dois NUNCA se somam.
 *
 * Dimensões e pesos do registro (PPT slide 8): Citação 20 · Presença 20 ·
 * Autoridade 20 · Posição 15 · Acurácia 15 · Sentimento 10. Decisão do dono
 * (19/ago): Autoridade e Acurácia SAEM do Score até o juiz LLM existir —
 * nada de card "em construção"; os pesos das 4 dimensões medidas são
 * renormalizados (mesma proporção relativa do registro). Quando o juiz
 * entrar, as duas voltam aqui com os pesos originais.
 *
 * Taxonomia (reunião de 19/ago): na UI, 'citation' exibe como "Leitura"
 * (como as fontes proprietárias são lidas pela IA) e 'position' como
 * "Ranking". As CHAVES não mudam — banco, actions e i18n keys ficam
 * estáveis; só os rótulos em web/messages/*.json.
 *
 * As faixas de nota são os mesmos quintis do IC
 * (`INDEX_SCORE_BANDS`/`indexScoreBand` em visibility-index.ts).
 */

export type ScoreDimKey = 'citation' | 'presence' | 'position' | 'sentiment';

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
  { key: 'position', n: '03', weight: 15, measured: true },
  { key: 'sentiment', n: '04', weight: 10, measured: true },
];
