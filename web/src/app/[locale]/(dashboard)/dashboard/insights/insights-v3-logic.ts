/**
 * Insights v3 (mockup do dono, 19/ago) — lógica pura das três seções novas:
 * funil da citação, scatter Menção × Citação e cards "Próxima ação".
 *
 * Mantida sem dependência de React/Supabase pra ser testável em unidade
 * (mesmo padrão de breakdown-display.ts). Os limiares de quadrante usam a
 * MÉDIA DO MERCADO exibido (todas as bolhas), não números mágicos: o mapa
 * se recalibra sozinho conforme o mercado da marca muda.
 */

// ─── Funil da citação ────────────────────────────────────────────────────────

export interface FunnelCounts {
  /** Respostas coletadas na janela (todas). */
  executions: number;
  /** Respostas que trazem QUALQUER fonte (citations jsonb não vazio). */
  grounded: number;
  /** Grounded que citam alguém do mercado acompanhado (marca OU concorrente). */
  marketCited: number;
  /** Respostas com citação da própria marca (citation_count > 0). */
  brandCited: number;
}

export interface FunnelRates {
  /** % de execuções que são grounded. */
  groundedPct: number;
  /** % de grounded que citam o mercado. */
  marketPct: number;
  /** % do mercado citado que cita a marca — "quando a IA cita o setor, quanto sobra pra você". */
  brandOfMarketPct: number;
  /** % de TODAS as grounded que citam a marca — a taxa de citação do mockup (12/462). */
  brandOfGroundedPct: number;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function funnelRates(f: FunnelCounts): FunnelRates {
  return {
    groundedPct: pct(f.grounded, f.executions),
    marketPct: pct(f.marketCited, f.grounded),
    brandOfMarketPct: pct(f.brandCited, f.marketCited),
    brandOfGroundedPct: pct(f.brandCited, f.grounded),
  };
}

/** Largura visual de cada barra do funil (1ª etapa = 100%; piso de 4% pra barra nunca sumir). */
export function funnelWidths(f: FunnelCounts): [number, number, number, number] {
  const base = Math.max(f.executions, 1);
  const w = (n: number) => Math.max(4, Math.round((n / base) * 100));
  return [100, w(f.grounded), w(f.marketCited), w(f.brandCited)];
}

// ─── Scatter Menção × Citação ────────────────────────────────────────────────

export type QuadrantKey = 'borrowed' | 'own' | 'invisible' | 'lost';

export interface ScatterBrand {
  name: string;
  mentions: number;
  citations: number;
  /** Presença em % de prompts (visibilityRate). */
  presence: number;
  isOwnBrand: boolean;
}

export interface ClassifiedBrand extends ScatterBrand {
  quadrant: QuadrantKey;
}

/**
 * Classifica cada marca pelo quadrante do mapa competitivo. Limiar = média
 * do conjunto exibido em cada eixo (menções e citações), como no mockup:
 * muita menção + pouca citação = narrativa emprestada; o inverso = crédito
 * perdido; os dois altos = narrativa sua; os dois baixos = invisível.
 */
export function classifyBrands(brands: ScatterBrand[]): ClassifiedBrand[] {
  if (brands.length === 0) return [];
  const avgMentions = brands.reduce((s, b) => s + b.mentions, 0) / brands.length;
  const avgCitations = brands.reduce((s, b) => s + b.citations, 0) / brands.length;
  return brands.map((b) => {
    const highMentions = b.mentions >= avgMentions;
    const highCitations = b.citations >= avgCitations;
    let quadrant: QuadrantKey;
    if (highMentions && highCitations) quadrant = 'own';
    else if (highMentions) quadrant = 'borrowed';
    else if (highCitations) quadrant = 'lost';
    else quadrant = 'invisible';
    return { ...b, quadrant };
  });
}

/**
 * Posição 0..1 em escala √ (mockup: "eixos em escala √ para caber os
 * extremos"). O máximo do eixo é o maior valor do conjunto (mín. 1).
 */
export function sqrtPosition(value: number, max: number): number {
  const m = Math.max(max, 1);
  return Math.sqrt(Math.max(value, 0)) / Math.sqrt(m);
}

// ─── Cards "Próxima ação" ────────────────────────────────────────────────────

export interface NextAction {
  key: 'sources' | 'legibility' | 'engineGap';
  hot: boolean;
  /** Números reais que originam o card (pro texto i18n interpolar). */
  params: Record<string, string | number>;
  /** Meta sugerida (ILUSTRATIVO — proveniência declarada na tela). */
  goalFrom: string;
  goalTo: string;
}

export interface EnginePresenceGap {
  weakestProvider: string;
  weakestPct: number;
  strongestProvider: string;
  strongestPct: number;
}

/**
 * Deriva os cards de próxima ação DOS NÚMEROS REAIS da tela (regra, não
 * LLM): cada card só nasce se o padrão que ele corrige existir de fato.
 * Ordem = urgência; o primeiro elegível vira "hot".
 */
export function deriveNextActions(input: {
  funnel: FunnelCounts | null;
  ownMentions: number;
  ownCitations: number;
  presencePct: number;
  visiblePrompts: number;
  promptCount: number;
  engineGap: EnginePresenceGap | null;
}): NextAction[] {
  const actions: NextAction[] = [];

  // 1. Narrativa emprestada: a IA fala da marca sem usar as fontes dela.
  if (input.ownMentions > 0 && input.ownMentions >= 3 * Math.max(input.ownCitations, 1)) {
    const rate = input.funnel ? funnelRates(input.funnel).brandOfGroundedPct : null;
    const from = rate ?? 0;
    actions.push({
      key: 'sources',
      hot: true,
      params: { mentions: input.ownMentions, citations: input.ownCitations },
      goalFrom: `${from}%`,
      goalTo: `${Math.max(Math.round(from * 2), 10)}%`,
    });
  }

  // 2. Legibilidade de máquina: presença baixa = prompts onde a marca não aparece.
  if (input.presencePct < 30 && input.promptCount > 0) {
    actions.push({
      key: 'legibility',
      hot: actions.length === 0,
      params: {
        missing: input.promptCount - input.visiblePrompts,
        total: input.promptCount,
        presence: input.presencePct,
      },
      goalFrom: `${input.presencePct}%`,
      goalTo: `${Math.min(Math.round(input.presencePct + 8), 100)}%`,
    });
  }

  // 3. Gap de engine: presença desigual entre motores (≥ 5 pontos).
  if (input.engineGap && input.engineGap.strongestPct - input.engineGap.weakestPct >= 5) {
    actions.push({
      key: 'engineGap',
      hot: actions.length === 0,
      params: {
        weakEngine: input.engineGap.weakestProvider,
        weakPct: input.engineGap.weakestPct,
        strongEngine: input.engineGap.strongestProvider,
        strongPct: input.engineGap.strongestPct,
      },
      goalFrom: `${input.engineGap.weakestPct}%`,
      goalTo: `${Math.min(Math.round(input.engineGap.weakestPct * 2), 100)}%`,
    });
  }

  return actions.slice(0, 3);
}

/**
 * Extrai o gap de presença por engine da própria marca a partir das
 * providerRows do comparativo (valores "12.3%" ou numéricos; linhas sem
 * valor parseável são ignoradas). Null com menos de 2 motores válidos.
 */
export function extractEngineGap(
  providerRows: Array<Record<string, string | number>>,
  ownBrandName: string,
): EnginePresenceGap | null {
  const parsed: Array<{ provider: string; value: number }> = [];
  for (const row of providerRows) {
    const raw = row[ownBrandName];
    const value =
      typeof raw === 'number' ? raw : raw ? Number(String(raw).replace(/[^\d.]/g, '')) : NaN;
    if (Number.isFinite(value) && typeof row.provider === 'string') {
      parsed.push({ provider: row.provider, value });
    }
  }
  if (parsed.length < 2) return null;
  parsed.sort((a, b) => a.value - b.value);
  const weakest = parsed[0];
  const strongest = parsed[parsed.length - 1];
  return {
    weakestProvider: weakest.provider,
    weakestPct: Math.round(weakest.value * 10) / 10,
    strongestProvider: strongest.provider,
    strongestPct: Math.round(strongest.value * 10) / 10,
  };
}
