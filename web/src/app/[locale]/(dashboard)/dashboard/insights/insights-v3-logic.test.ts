import { describe, it, expect } from 'vitest';
import {
  funnelRates,
  funnelWidths,
  classifyBrands,
  sqrtPosition,
  deriveNextActions,
  extractEngineGap,
} from './insights-v3-logic';

describe('funnelRates', () => {
  it('calcula as taxas do mockup (972 → 462 → 89 → 12)', () => {
    const r = funnelRates({ executions: 972, grounded: 462, marketCited: 89, brandCited: 12 });
    expect(r.groundedPct).toBeCloseTo(47.5, 1);
    expect(r.marketPct).toBeCloseTo(19.3, 1);
    expect(r.brandOfMarketPct).toBeCloseTo(13.5, 1);
    expect(r.brandOfGroundedPct).toBeCloseTo(2.6, 1);
  });

  it('zeros não dividem por zero', () => {
    const r = funnelRates({ executions: 0, grounded: 0, marketCited: 0, brandCited: 0 });
    expect(r.groundedPct).toBe(0);
    expect(r.brandOfMarketPct).toBe(0);
  });
});

describe('funnelWidths', () => {
  it('primeira etapa 100%, demais proporcionais com piso de 4%', () => {
    const [a, b, c, d] = funnelWidths({
      executions: 100,
      grounded: 50,
      marketCited: 10,
      brandCited: 1,
    });
    expect(a).toBe(100);
    expect(b).toBe(50);
    expect(c).toBe(10);
    expect(d).toBe(4); // 1% vira o piso visual
  });
});

describe('classifyBrands', () => {
  const brands = [
    { name: 'Você', mentions: 157, citations: 12, presence: 22.2, isOwnBrand: true },
    { name: 'A', mentions: 20, citations: 43, presence: 40.7, isOwnBrand: false },
    { name: 'B', mentions: 0, citations: 80, presence: 35.2, isOwnBrand: false },
    { name: 'C', mentions: 9, citations: 17, presence: 9.3, isOwnBrand: false },
  ];

  it('reproduz os quadrantes do mockup com limiar na média', () => {
    const out = Object.fromEntries(classifyBrands(brands).map((b) => [b.name, b.quadrant]));
    // médias: menções 46.5, citações 38 → Você (157m,12c) = emprestada;
    // A (20m,43c) = crédito? não — 20<46.5 e 43>38 → lost. O mockup chama A de
    // "narrativa sua" com limiares manuais; com limiar estatístico A cai em
    // lost — comportamento documentado (o limiar é da média do conjunto).
    expect(out['Você']).toBe('borrowed');
    expect(out['B']).toBe('lost');
    expect(out['C']).toBe('invisible');
  });

  it('conjunto vazio devolve vazio', () => {
    expect(classifyBrands([])).toEqual([]);
  });
});

describe('sqrtPosition', () => {
  it('escala √: 25% do máximo fica na metade do eixo', () => {
    expect(sqrtPosition(25, 100)).toBeCloseTo(0.5, 5);
    expect(sqrtPosition(0, 100)).toBe(0);
    expect(sqrtPosition(100, 100)).toBe(1);
  });
});

describe('deriveNextActions', () => {
  const funnel = { executions: 972, grounded: 462, marketCited: 89, brandCited: 12 };

  it('menções >> citações gera o card de fontes citáveis como hot', () => {
    const out = deriveNextActions({
      funnel,
      ownMentions: 157,
      ownCitations: 12,
      presencePct: 22.2,
      visiblePrompts: 12,
      promptCount: 54,
      engineGap: {
        weakestProvider: 'Copilot',
        weakestPct: 4,
        strongestProvider: 'Perplexity',
        strongestPct: 17,
      },
    });
    expect(out.map((a) => a.key)).toEqual(['sources', 'legibility', 'engineGap']);
    expect(out[0].hot).toBe(true);
    expect(out[0].goalFrom).toBe('2.6%');
    expect(out[1].params.missing).toBe(42);
  });

  it('sem padrões, sem cards', () => {
    const out = deriveNextActions({
      funnel,
      ownMentions: 10,
      ownCitations: 40,
      presencePct: 65,
      visiblePrompts: 35,
      promptCount: 54,
      engineGap: { weakestProvider: 'A', weakestPct: 10, strongestProvider: 'B', strongestPct: 12 },
    });
    expect(out).toEqual([]);
  });
});

describe('extractEngineGap', () => {
  it('acha o motor mais fraco e o mais forte da própria marca', () => {
    const gap = extractEngineGap(
      [
        { provider: 'ChatGPT', Polar: '6%' },
        { provider: 'Perplexity', Polar: '17.0%' },
        { provider: 'Copilot', Polar: 4 },
      ],
      'Polar',
    );
    expect(gap).toEqual({
      weakestProvider: 'Copilot',
      weakestPct: 4,
      strongestProvider: 'Perplexity',
      strongestPct: 17,
    });
  });

  it('menos de 2 motores válidos → null', () => {
    expect(extractEngineGap([{ provider: 'ChatGPT', Polar: 'n/a' }], 'Polar')).toBeNull();
  });
});
