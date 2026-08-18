import { describe, it, expect } from 'vitest';
import { reviewScoreFrom } from './review-check.js';

// A régua v1 do D4 (mapeamento dos quintis do doc de 17/ago): presença
// confirmada dá a base, a nota média ajusta, e "tudo unknown" NÃO pontua —
// sem informação não se dá nota.
describe('reviewScoreFrom (régua v1 do D4)', () => {
  const row = (found, rating = null) => ({ platform: 'x', found, rating });

  it('devolve null quando nenhuma plataforma pôde ser verificada', () => {
    expect(reviewScoreFrom([row(null), row(null), row(null), row(null)])).toBeNull();
  });

  it('ausência confirmada em todas → faixa 0-20', () => {
    expect(reviewScoreFrom([row(false), row(false), row(false), row(false)])).toBe(10);
  });

  it('1 plataforma confirmada sem nota → faixa 21-40', () => {
    expect(reviewScoreFrom([row(true), row(false), row(null), row(false)])).toBe(30);
  });

  it('2-3 plataformas com nota ~4.0 → faixa 41-60', () => {
    expect(reviewScoreFrom([row(true, 4.0), row(true, 4.1), row(false), row(null)])).toBe(50);
  });

  it('presença ampla com nota ≥4.5 → topo da régua', () => {
    const rows = [row(true, 4.6), row(true, 4.7), row(true, 4.5), row(true, 4.8)];
    expect(reviewScoreFrom(rows)).toBe(85);
  });

  it('nota média ruim (<3.5) desconta', () => {
    expect(reviewScoreFrom([row(true, 2.8), row(true, 3.1), row(false), row(false)])).toBe(40);
  });

  it('unknowns não impedem a nota quando há pelo menos uma verificação', () => {
    expect(reviewScoreFrom([row(true, 4.6), row(null), row(null), row(null)])).toBe(50);
  });
});
