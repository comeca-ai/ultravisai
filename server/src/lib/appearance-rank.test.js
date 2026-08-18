import { describe, it, expect } from 'vitest';
import { firstIndexOf, appearanceRankFor } from './appearance-rank.js';

// Posição por ORDEM DE APARIÇÃO (premissa de 18/ago): quem é citado primeiro
// no texto fica na frente — volume de menções não importa aqui.
describe('firstIndexOf', () => {
  it('acha a primeira ocorrência de qualquer termo, ignorando caixa', () => {
    expect(firstIndexOf('O GARMIN e a polar são boas', ['Polar'])).toBe(13);
    expect(firstIndexOf('O GARMIN e a polar são boas', ['garmin', 'polar'])).toBe(2);
  });

  it('exige palavra inteira e devolve -1 quando não há', () => {
    expect(firstIndexOf('Polaridade não é marca', ['Polar'])).toBe(-1);
    expect(firstIndexOf('nada aqui', ['Garmin'])).toBe(-1);
  });
});

describe('appearanceRankFor (rank de ordem de aparição)', () => {
  const brand = ['Polar', 'polar.com'];
  const comps = [['Garmin'], ['Apple', 'apple.com'], ['Coros']];

  it('citada primeiro → 1º, mesmo com menos menções que os rivais', () => {
    const text = 'A Polar é uma opção. Mas o Garmin, o Garmin e o Garmin dominam. Apple também.';
    expect(appearanceRankFor(text, brand, comps)).toEqual({ rank: 1, rivals: 2 });
  });

  it('conta só quem aparece ANTES: 2 antes + 1 depois → rank 3', () => {
    const text = 'Garmin e Apple lideram; a Polar vem crescendo e o Coros fecha a lista.';
    expect(appearanceRankFor(text, brand, comps)).toEqual({ rank: 3, rivals: 3 });
  });

  it('sozinha na resposta → 1º de um campo sem rivais', () => {
    expect(appearanceRankFor('A Polar lançou um relógio novo.', brand, comps)).toEqual({
      rank: 1,
      rivals: 0,
    });
  });

  it('marca ausente do texto → null (fora do grupo da Posição)', () => {
    expect(appearanceRankFor('Garmin e Apple dominam o mercado.', brand, comps)).toBeNull();
  });

  it('URLs não contam como menção (espelho do parser)', () => {
    const text = 'Veja https://polar.com/loja — o Garmin é citado antes? Não: garmin só aqui.';
    // polar.com só existe dentro da URL (removida) → marca ausente.
    expect(appearanceRankFor(text, ['polar.com'], comps)).toBeNull();
  });
});
