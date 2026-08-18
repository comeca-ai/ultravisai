import { describe, it, expect } from 'vitest';
import { reviewScoreFrom, normalizeSerpRating, pickProfileHit } from './review-check.js';

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

describe('normalizeSerpRating (nota da SERP → escala 0-5)', () => {
  it('mantém escala Max5 como está', () => {
    expect(normalizeSerpRating({ value: 4.6, rating_max: 5 })).toBe(4.6);
  });

  it('normaliza escala 0-10 (Reclame Aqui) para 0-5', () => {
    expect(normalizeSerpRating({ value: 7.8, rating_max: 10 })).toBe(3.9);
  });

  it('sem rating_max assume 5; sem value devolve null', () => {
    expect(normalizeSerpRating({ value: 4.2 })).toBe(4.2);
    expect(normalizeSerpRating(undefined)).toBeNull();
    expect(normalizeSerpRating({ value: 'n/a' })).toBeNull();
  });
});

describe('pickProfileHit (URL de perfil na SERP)', () => {
  const re = /reclameaqui\.com\.br\/empresa\//i;

  it('acha o primeiro orgânico que bate com o padrão de perfil', () => {
    const items = [
      { type: 'paid', url: 'https://www.reclameaqui.com.br/empresa/anuncio/' },
      { type: 'organic', url: 'https://www.reclameaqui.com.br/categoria/eletronicos/' },
      { type: 'organic', url: 'https://www.reclameaqui.com.br/empresa/polar/' },
    ];
    expect(pickProfileHit(items, re)?.url).toContain('/empresa/polar');
  });

  it('devolve null quando nenhum resultado é perfil', () => {
    expect(pickProfileHit([{ type: 'organic', url: 'https://blog.exemplo.com/' }], re)).toBeNull();
    expect(pickProfileHit([], re)).toBeNull();
    expect(pickProfileHit(undefined, re)).toBeNull();
  });
});
