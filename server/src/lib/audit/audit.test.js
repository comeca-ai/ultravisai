import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { scoreAudit } from './scorer.js';
import { categories } from './rubric.js';
import { fleschReadingEase, classifyLinks, jsonLd, countPhrases } from './signals/helpers.js';
import {
  jsonLdPresence,
  h1Quality,
  sitemapPresence,
  productSchema,
  rendering,
  languageCountry,
  descriptiveTitle,
} from './signals/structure.js';
import { https, metaDescription } from './signals/trust.js';
import { length } from './signals/content.js';
import { withRetry } from '../retry.js';

/** Build a minimal audit context from an HTML string (no network). */
function ctxFromHtml(html, extra = {}) {
  const text = cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim();
  return {
    url: 'https://example.com/page',
    origin: 'https://example.com',
    protocol: 'https',
    statusCode: 200,
    html,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    $: cheerio.load(html),
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
    robotsTxt: null,
    llmsTxt: null,
    now: Date.UTC(2026, 0, 1),
    ...extra,
  };
}

describe('scoreAudit', () => {
  it('averages within a category and normalizes the total over evaluated categories', () => {
    const results = [
      { key: 'json-ld-presence', status: 'pass', score: 1 }, // structure
      { key: 'h1-quality', status: 'fail', score: 0 }, // structure
      { key: 'https', status: 'pass', score: 1 }, // trust
    ];
    const { totalScore, categoryScores } = scoreAudit(results);

    expect(categoryScores.structure.score).toBeCloseTo(0.5, 5);
    expect(categoryScores.structure.evaluated).toBe(2);
    // Lido da rubrica em vez de fixo: este teste é sobre a média dentro da
    // categoria e a renormalização entre categorias, não sobre quantos sinais
    // existem. Fixar o número fazia o teste quebrar toda vez que a rubrica
    // crescia — foi o que aconteceu ao entrarem `sitemap-presence` e
    // `product-schema` (13 → 15) em 09/set.
    const totalEstrutura = categories.find((c) => c.key === 'structure').signalCount;
    expect(categoryScores.structure.total).toBe(totalEstrutura);
    expect(categoryScores.trust.score).toBe(1);
    // (0.25*0.5 + 0.10*1) / (0.25 + 0.10) = 0.643
    expect(totalScore).toBeCloseTo(0.6428, 3);
  });

  it('excludes na signals and reports null for categories with no evaluated signals', () => {
    const results = [
      { key: 'https', status: 'pass', score: 1 },
      { key: 'json-ld-presence', status: 'na', score: null },
    ];
    const { categoryScores } = scoreAudit(results);
    expect(categoryScores.structure.score).toBeNull();
    expect(categoryScores.structure.evaluated).toBe(0);
    expect(categoryScores.trust.score).toBe(1);
  });
});

describe('helpers', () => {
  it('fleschReadingEase returns null for short text and a number for enough text', () => {
    expect(fleschReadingEase('Too short.')).toBeNull();
    const text = Array.from({ length: 40 }, () => 'the cat sat on the mat').join('. ') + '.';
    expect(typeof fleschReadingEase(text)).toBe('number');
  });

  it('classifyLinks splits internal vs external', () => {
    const ctx = ctxFromHtml(
      `<a href="/about">a</a><a href="https://example.com/x">b</a>
       <a href="https://other.com/y">c</a><a href="#frag">d</a><a href="mailto:x@y.com">e</a>`,
    );
    const { internal, external } = classifyLinks(ctx);
    expect(internal.length).toBe(2); // /about + example.com/x
    expect(external.length).toBe(1); // other.com
  });

  it('jsonLd parses blocks and counts valid ones', () => {
    const ctx = ctxFromHtml(
      `<script type="application/ld+json">{"@type":"Article"}</script>
       <script type="application/ld+json">not json</script>`,
    );
    const { total, valid, nodes } = jsonLd(ctx);
    expect(total).toBe(2);
    expect(valid).toBe(1);
    expect(nodes).toHaveLength(1);
  });

  it('countPhrases counts case-insensitive occurrences', () => {
    expect(countPhrases('We tested it. Then WE TESTED again.', ['we tested'])).toBe(2);
  });
});

describe('withRetry', () => {
  it('returns the value on first success without retrying', async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls += 1;
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 0 },
    );
    expect(out).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries transient failures then succeeds', async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('transient');
        return 'recovered';
      },
      { attempts: 3, baseDelayMs: 0 },
    );
    expect(out).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('throws the last error after exhausting attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('always');
        },
        { attempts: 2, baseDelayMs: 0 },
      ),
    ).rejects.toThrow('always');
    expect(calls).toBe(2);
  });
});

describe('deterministic signals', () => {
  it('h1-quality: pass for one well-sized H1, fail for none', () => {
    const good = h1Quality.evaluate(ctxFromHtml('<h1>The Best Running Shoes for Marathons</h1>'));
    expect(good.status).toBe('pass');
    expect(good.score).toBe(1);
    expect(h1Quality.evaluate(ctxFromHtml('<p>no heading</p>')).status).toBe('fail');
  });

  it('json-ld-presence: pass when a block exists', () => {
    const r = jsonLdPresence.evaluate(
      ctxFromHtml('<script type="application/ld+json">{"@type":"Article"}</script>'),
    );
    expect(r.status).toBe('pass');
  });

  it('sitemap-presence: pass só com arquivo E declaração no robots', () => {
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://example.com/a</loc></url>' +
      '<url><loc>https://example.com/b</loc></url></urlset>';
    const completo = sitemapPresence.evaluate(
      ctxFromHtml('<p>x</p>', {
        sitemapXml: xml,
        robotsTxt: 'Sitemap: https://example.com/sitemap.xml',
      }),
    );
    expect(completo.status).toBe('pass');
    expect(completo.evidence.urls).toBe(2);

    // Existe mas ninguém aponta pra ele: meio caminho.
    expect(sitemapPresence.evaluate(ctxFromHtml('<p>x</p>', { sitemapXml: xml })).status).toBe(
      'warn',
    );
    // Nada dos dois lados.
    expect(sitemapPresence.evaluate(ctxFromHtml('<p>x</p>')).status).toBe('fail');
  });

  it('sitemap-presence: 404 que responde HTML não conta como sitemap', () => {
    const r = sitemapPresence.evaluate(
      ctxFromHtml('<p>x</p>', { sitemapXml: '<!doctype html><html><body>Not found</body></html>' }),
    );
    expect(r.evidence.existe).toBe(false);
    expect(r.status).toBe('fail');
  });

  it('sitemap-presence: sitemapindex conta como existente, sem inflar a contagem de páginas', () => {
    const indice =
      '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>';
    const r = sitemapPresence.evaluate(ctxFromHtml('<p>x</p>', { sitemapXml: indice }));
    expect(r.evidence.existe).toBe(true);
    expect(r.evidence.urls).toBe(0);
  });

  it('product-schema: na fora de página de produto, fail quando parece produto e falta bloco', () => {
    expect(productSchema.evaluate(ctxFromHtml('<h1>Sobre nós</h1>')).status).toBe('na');

    const parece = productSchema.evaluate(
      ctxFromHtml(
        '<html><head><meta property="og:type" content="product"></head><body></body></html>',
      ),
    );
    expect(parece.status).toBe('fail');
  });

  it('product-schema: pass com os três campos, warn quando falta algum', () => {
    const bloco = (extra) =>
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        name: 'Polar Vantage V3',
        ...extra,
      })}</script>`;

    const completo = productSchema.evaluate(
      ctxFromHtml(bloco({ offers: { price: '4999' }, aggregateRating: { ratingValue: 4.7 } })),
    );
    expect(completo.status).toBe('pass');

    const parcial = productSchema.evaluate(ctxFromHtml(bloco({ offers: { price: '4999' } })));
    expect(parcial.status).toBe('warn');
    expect(parcial.evidence.faltando).toEqual(['aggregateRating']);
  });

  it('product-schema: numa listagem, o bloco mais completo é que vale', () => {
    const html =
      '<script type="application/ld+json">' +
      JSON.stringify([
        { '@type': 'Product', name: 'Pobre' },
        {
          '@type': 'Product',
          name: 'Completo',
          offers: { price: '1' },
          aggregateRating: { ratingValue: 5 },
        },
      ]) +
      '</script>';
    const r = productSchema.evaluate(ctxFromHtml(html));
    expect(r.status).toBe('pass');
    expect(r.evidence.produtos).toBe(2);
  });

  it('rendering: na sem HTML cru, pass quando o texto já vem sem JS', () => {
    // O \n entre os blocos não é enfeite: cheerio concatena o texto dos nós
    // sem separador, então '<p>a</p><p>b</p>' vira a palavra única "ab" e a
    // página passaria por curta demais. HTML de verdade vem com quebra.
    const corpo = '<body>' + '<p>palavra</p>\n'.repeat(120) + '</body>';
    // Sem a segunda busca, o sinal se declara não medido — nunca reprova.
    expect(rendering.evaluate(ctxFromHtml(corpo)).status).toBe('na');

    const igual = rendering.evaluate(ctxFromHtml(corpo, { htmlCru: corpo }));
    expect(igual.status).toBe('pass');
    expect(igual.evidence.percentualVisivelSemJs).toBe(100);
  });

  it('rendering: fail quando o conteúdo só existe depois do JS', () => {
    const comJs = '<body>' + '<p>palavra</p>\n'.repeat(200) + '</body>';
    const semJs = '<body><div id="root"></div></body>';
    const r = rendering.evaluate(ctxFromHtml(comJs, { htmlCru: semJs }));
    expect(r.status).toBe('fail');
    expect(r.evidence.palavrasSemJs).toBe(0);
  });

  it('rendering: página curta demais não vira veredito', () => {
    const curta = '<body><p>oi</p></body>';
    expect(rendering.evaluate(ctxFromHtml(curta, { htmlCru: curta })).status).toBe('na');
  });

  it('language-country: fail sem lang, warn com lang genérico, pass com região ou hreflang', () => {
    expect(languageCountry.evaluate(ctxFromHtml('<html><body>x</body></html>')).status).toBe(
      'fail',
    );

    const generico = languageCountry.evaluate(ctxFromHtml('<html lang="pt"><body>x</body></html>'));
    expect(generico.status).toBe('warn');

    // `pt-BR` já carrega o país.
    expect(
      languageCountry.evaluate(ctxFromHtml('<html lang="pt-BR"><body>x</body></html>')).status,
    ).toBe('pass');

    const comAlternates = languageCountry.evaluate(
      ctxFromHtml(
        '<html lang="pt"><head><link rel="alternate" hreflang="en" href="/en">' +
          '<link rel="alternate" hreflang="es" href="/es"></head><body>x</body></html>',
      ),
    );
    expect(comAlternates.status).toBe('pass');
    expect(comAlternates.evidence.hreflang).toEqual(['en', 'es']);
  });

  it('descriptive-title: fail sem title e com marca sozinha, pass quando descreve', () => {
    const t = (html) => descriptiveTitle.evaluate(ctxFromHtml(html));

    // Sem <title> nenhum.
    expect(t('<html><head></head><body>x</body></html>').status).toBe('fail');

    // Só o nome da marca — é o caso que o checklist do Igor nomeia.
    expect(t('<html><head><title>Polar</title></head><body>x</body></html>').status).toBe('fail');

    // Marca repetida com separador continua não descrevendo nada.
    const soMarca = t('<html><head><title>Polar | Polar</title></head><body>x</body></html>');
    expect(soMarca.status).toBe('fail');

    // Título magro mas que ao menos diz do que se trata: avisa, não reprova.
    // "Produtos Polar" (14) cai abaixo do corte e reprova — rótulo genérico
    // curto não descreve página nenhuma.
    expect(
      t('<html><head><title>Relógios esportivos</title></head><body>x</body></html>').status,
    ).toBe('warn');
    expect(t('<html><head><title>Produtos Polar</title></head><body>x</body></html>').status).toBe(
      'fail',
    );

    const bom = t(
      '<html><head><title>Relógio esportivo com GPS e mapa | Polar Vantage</title></head>' +
        '<body>x</body></html>',
    );
    expect(bom.status).toBe('pass');
    expect(bom.score).toBe(1);
    expect(bom.evidence.partes).toBe(2);
  });

  it('https: pass over TLS without mixed content, warn with an http asset', () => {
    expect(https.evaluate(ctxFromHtml('<img src="https://x/i.png">')).status).toBe('pass');
    const mixed = https.evaluate(ctxFromHtml('<img src="http://x/i.png">'));
    expect(mixed.status).toBe('warn');
    expect(https.evaluate(ctxFromHtml('<p>x</p>', { protocol: 'http' })).status).toBe('fail');
  });

  it('meta-description: pass for 80–160 chars, fail when absent', () => {
    const desc = 'x'.repeat(120);
    expect(
      metaDescription.evaluate(ctxFromHtml(`<meta name="description" content="${desc}">`)).status,
    ).toBe('pass');
    expect(metaDescription.evaluate(ctxFromHtml('<p>x</p>')).status).toBe('fail');
  });

  it('length: pass for 800–3000 words', () => {
    expect(length.evaluate(ctxFromHtml('<p>x</p>', { wordCount: 1200 })).status).toBe('pass');
    expect(length.evaluate(ctxFromHtml('<p>x</p>', { wordCount: 100 })).status).toBe('fail');
  });
});
