import { describe, it, expect } from 'vitest';
import { parseSitemapLocs, pickKeyPages, aggregateCoverage } from './site-crawl.js';

describe('parseSitemapLocs', () => {
  it('extrai as <loc> e decodifica &amp;', () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://ex.com/</loc></url>
      <url><loc> https://ex.com/sobre?a=1&amp;b=2 </loc></url>
    </urlset>`;
    expect(parseSitemapLocs(xml)).toEqual(['https://ex.com/', 'https://ex.com/sobre?a=1&b=2']);
  });

  it('devolve vazio para conteúdo sem <loc>', () => {
    expect(parseSitemapLocs('<html>404</html>')).toEqual([]);
    expect(parseSitemapLocs(null)).toEqual([]);
  });
});

describe('pickKeyPages (seleção das páginas-chave)', () => {
  const home = 'https://ex.com/';

  it('homepage primeiro, depois páginas-chave por prioridade', () => {
    const picked = pickKeyPages(home, [
      'https://ex.com/blog/post-123',
      'https://ex.com/sobre',
      'https://ex.com/precos',
      'https://ex.com/servicos',
    ]);
    expect(picked[0]).toBe(home);
    expect(picked[1]).toContain('/sobre');
    expect(picked[2]).toContain('/servicos');
    expect(picked[3]).toContain('/precos');
  });

  it('descarta outros hosts, assets e duplicatas; respeita o máximo', () => {
    const picked = pickKeyPages(
      home,
      [
        'https://outro.com/sobre',
        'https://ex.com/logo.png',
        'https://ex.com/a',
        'https://ex.com/a/',
        'https://ex.com/b',
        'https://ex.com/c',
      ],
      3,
    );
    expect(picked).toHaveLength(3);
    expect(picked.every((u) => u.startsWith('https://ex.com'))).toBe(true);
    expect(picked.filter((u) => u.includes('/a')).length).toBe(1);
  });

  it('resolve links relativos da homepage (fallback de âncoras)', () => {
    const picked = pickKeyPages(home, ['/contato', '#topo', 'mailto:x@ex.com']);
    expect(picked).toEqual([home, 'https://ex.com/contato']);
  });

  it('caminhos mais curtos preenchem as vagas restantes', () => {
    const picked = pickKeyPages(home, ['https://ex.com/a/b/c', 'https://ex.com/x'], 3);
    expect(picked[1]).toBe('https://ex.com/x');
    expect(picked[2]).toBe('https://ex.com/a/b/c');
  });
});

describe('aggregateCoverage ("Org schema em 8/10 páginas")', () => {
  it('conta pass sobre avaliadas, ignorando na', () => {
    const cov = aggregateCoverage([
      { signals: { 'json-ld-presence': 'pass', 'faq-schema': 'fail' } },
      { signals: { 'json-ld-presence': 'pass', 'faq-schema': 'na' } },
      { signals: { 'json-ld-presence': 'warn' } },
    ]);
    expect(cov['json-ld-presence']).toEqual({ pass: 2, evaluated: 3 });
    expect(cov['faq-schema']).toEqual({ pass: 0, evaluated: 1 });
  });

  it('página com erro (sem signals) não conta', () => {
    expect(aggregateCoverage([{ signals: {} }, {}])).toEqual({});
  });
});
