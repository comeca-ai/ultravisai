/**
 * Structure-category signal evaluators (17 signals).
 *
 * Each evaluator is `{ key, evaluate(ctx) => { status, score, evidence } }`:
 *   - status: 'pass' | 'warn' | 'fail' | 'na'
 *   - score:  0..1 (null when 'na')
 *   - evidence: small object surfaced in the UI to explain the verdict
 *
 * Rubric copy (label/what/why/howToFix) is merged in from rubric.js at
 * response-assembly time, so evaluators stay purely about measurement.
 */

import * as cheerio from 'cheerio';

import { jsonLd, typesOf, classifyLinks, metaContent } from './helpers.js';

// schema.org types that signal a specific, AI-citable content intent.
const HIGH_VALUE_TYPES = new Set([
  'article',
  'newsarticle',
  'blogposting',
  'product',
  'faqpage',
  'howto',
  'recipe',
  'review',
  'qapage',
  'techarticle',
  'medicalwebpage',
  'event',
  'softwareapplication',
]);

export const structuralDepth = {
  key: 'structural-depth',
  evaluate(ctx) {
    const levels = ctx.$('h1, h2, h3, h4, h5, h6');
    const present = new Set();
    let skips = 0;
    let prev = 0;
    levels.each((_, el) => {
      const lvl = Number(el.tagName.replace(/[^1-6]/g, ''));
      present.add(lvl);
      if (prev && lvl > prev + 1) skips += 1;
      prev = lvl;
    });
    const depth = present.size;
    const hasNesting = present.has(1) && present.has(2) && present.has(3);

    let status = 'fail';
    let score = 0.2;
    if (hasNesting && skips === 0) {
      status = 'pass';
      score = 1;
    } else if (depth >= 2) {
      status = 'warn';
      score = 0.6;
    }
    return { status, score, evidence: { depth, levelSkips: skips, levels: [...present].sort() } };
  },
};

export const internalLinking = {
  key: 'internal-linking',
  evaluate(ctx) {
    const { internal } = classifyLinks(ctx);
    const count = internal.length;
    let status = 'fail';
    let score = 0;
    if (count >= 5) {
      status = 'pass';
      score = 1;
    } else if (count >= 1) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { internalLinks: count } };
  },
};

export const pageWeight = {
  key: 'page-weight',
  evaluate(ctx) {
    const kb = Math.round(ctx.htmlBytes / 1024);
    let status = 'pass';
    let score = 1;
    if (kb > 1024) {
      status = 'fail';
      score = 0;
    } else if (kb > 500) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { htmlKb: kb } };
  },
};

export const jsonLdPresence = {
  key: 'json-ld-presence',
  evaluate(ctx) {
    const { total } = jsonLd(ctx);
    return {
      status: total > 0 ? 'pass' : 'fail',
      score: total > 0 ? 1 : 0,
      evidence: { blockCount: total },
    };
  },
};

export const jsonLdValidity = {
  key: 'json-ld-validity',
  evaluate(ctx) {
    const { nodes, total, valid } = jsonLd(ctx);
    if (total === 0) {
      return { status: 'fail', score: 0, evidence: { reason: 'no JSON-LD blocks' } };
    }
    // Among parsed nodes, how many declare a schema.org @context + a @type?
    const wellFormed = nodes.filter((n) => {
      const ctxStr = JSON.stringify(n['@context'] ?? '').toLowerCase();
      return ctxStr.includes('schema.org') && typesOf(n).length > 0;
    }).length;

    let status = 'fail';
    let score = 0;
    if (valid === total && wellFormed > 0) {
      status = 'pass';
      score = 1;
    } else if (valid > 0 && wellFormed > 0) {
      status = 'warn';
      score = 0.5;
    }
    return {
      status,
      score,
      evidence: { blocks: total, parsed: valid, wellFormedNodes: wellFormed },
    };
  },
};

export const jsonLdRelevance = {
  key: 'json-ld-relevance',
  evaluate(ctx) {
    const { nodes } = jsonLd(ctx);
    const allTypes = nodes.flatMap(typesOf);
    if (allTypes.length === 0) {
      return { status: 'fail', score: 0, evidence: { types: [] } };
    }
    const hasHighValue = allTypes.some((t) => HIGH_VALUE_TYPES.has(t));
    return {
      status: hasHighValue ? 'pass' : 'warn',
      score: hasHighValue ? 1 : 0.5,
      evidence: { types: [...new Set(allTypes)].slice(0, 8) },
    };
  },
};

export const faqSchema = {
  key: 'faq-schema',
  evaluate(ctx) {
    const { nodes } = jsonLd(ctx);
    const faq = nodes.find((n) => typesOf(n).includes('faqpage'));
    const qa = faq && Array.isArray(faq.mainEntity) ? faq.mainEntity.length : 0;
    const ok = Boolean(faq) && qa >= 2;
    return {
      status: ok ? 'pass' : 'fail',
      score: ok ? 1 : 0,
      evidence: { faqPage: Boolean(faq), questionCount: qa },
    };
  },
};

export const h1Quality = {
  key: 'h1-quality',
  evaluate(ctx) {
    const h1s = ctx.$('h1');
    const count = h1s.length;
    const text = h1s.first().text().replace(/\s+/g, ' ').trim();
    const length = text.length;
    const exactlyOne = count === 1;
    const idealLength = length >= 20 && length <= 70;

    let status = 'fail';
    let score = 0;
    if (exactlyOne && idealLength) {
      status = 'pass';
      score = 1;
    } else if (count >= 1 && length >= 10 && length <= 90) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { count, length, text: text.slice(0, 120) } };
  },
};

export const h2Coverage = {
  key: 'h2-coverage',
  evaluate(ctx) {
    const count = ctx.$('h2').length;
    let status = 'fail';
    let score = 0;
    if (count >= 3) {
      status = 'pass';
      score = 1;
    } else if (count >= 1) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { h2Count: count } };
  },
};

export const lists = {
  key: 'lists',
  evaluate(ctx) {
    let withThree = 0;
    let any = 0;
    ctx.$('ul, ol').each((_, el) => {
      any += 1;
      if (ctx.$(el).children('li').length >= 3) withThree += 1;
    });
    let status = 'fail';
    let score = 0;
    if (withThree >= 1) {
      status = 'pass';
      score = 1;
    } else if (any >= 1) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { lists: any, listsWith3PlusItems: withThree } };
  },
};

export const tables = {
  key: 'tables',
  evaluate(ctx) {
    const total = ctx.$('table').length;
    const structured = ctx.$('table').filter((_, el) => {
      const $t = ctx.$(el);
      return $t.find('thead').length > 0 && $t.find('tbody').length > 0;
    }).length;
    let status = 'fail';
    let score = 0;
    if (structured >= 1) {
      status = 'pass';
      score = 1;
    } else if (total >= 1) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { tables: total, structuredTables: structured } };
  },
};

export const altText = {
  key: 'alt-text',
  evaluate(ctx) {
    const imgs = ctx.$('img');
    const total = imgs.length;
    if (total === 0) {
      return { status: 'na', score: null, evidence: { images: 0 } };
    }
    let withAlt = 0;
    imgs.each((_, el) => {
      const alt = ctx.$(el).attr('alt');
      if (typeof alt === 'string' && alt.trim().length > 0) withAlt += 1;
    });
    const ratio = withAlt / total;
    let status = 'fail';
    let score = ratio;
    if (ratio >= 0.8) status = 'pass';
    else if (ratio >= 0.5) status = 'warn';
    return {
      status,
      score: Number(score.toFixed(2)),
      evidence: { images: total, withAlt, ratio: Number(ratio.toFixed(2)) },
    };
  },
};

export const openGraph = {
  key: 'open-graph',
  evaluate(ctx) {
    const tags = ['og:title', 'og:description', 'og:image', 'og:type'];
    const present = tags.filter((t) => metaContent(ctx, t));
    const n = present.length;
    let status = 'fail';
    let score = 0;
    if (n === 4) {
      status = 'pass';
      score = 1;
    } else if (n >= 1) {
      status = 'warn';
      score = n / 4;
    }
    return {
      status,
      score: Number(score.toFixed(2)),
      evidence: { present, missing: tags.filter((t) => !present.includes(t)) },
    };
  },
};

/**
 * `sitemap-presence` — item 5 dos 9 do slide P3 do Igor, e o único que
 * nenhum dos 47 sinais olhava.
 *
 * Duas metades, porque uma sem a outra não resolve: o arquivo tem que existir
 * E o robots.txt tem que apontar pra ele. Crawler que chega pelo robots (o
 * caminho normal de um bot de IA) não adivinha a URL do sitemap; sitemap
 * declarado mas ausente é pior ainda, manda o bot pra um 404.
 */
export const sitemapPresence = {
  key: 'sitemap-presence',
  evaluate(ctx) {
    const xml = (ctx.sitemapXml || '').trim();
    // Um 404 costuma voltar como página HTML, não como erro de rede — sem
    // esta conferência o sinal daria "existe" pra qualquer site.
    const existe = xml.length > 0 && /<(urlset|sitemapindex)\b/i.test(xml);
    const declarado = /^\s*sitemap:\s*\S+/im.test(ctx.robotsTxt || '');

    // Só conta URL de <loc> dentro de <url>: num sitemapindex os <loc>
    // apontam pra outros sitemaps, e contá-los como páginas mentiria.
    let urls = 0;
    if (existe) {
      const blocos = xml.match(/<url\b[\s\S]*?<\/url>/gi) || [];
      urls = blocos.length;
    }

    let status = 'fail';
    let score = 0;
    if (existe && declarado) {
      status = 'pass';
      score = 1;
    } else if (existe || declarado) {
      status = 'warn';
      score = 0.5;
    }
    return { status, score, evidence: { existe, declaradoNoRobots: declarado, urls } };
  },
};

/**
 * `product-schema` — item 4 dos 9 do slide. Separa "a IA sabe que o produto
 * existe" de "a IA sabe o preço e a nota", que é o que decide se a marca
 * entra num comparativo montado pelo motor.
 *
 * Página que não é de produto recebe `na` em vez de zero: o scorer
 * renormaliza e a nota não é punida por uma home não ser uma ficha de
 * produto. A conferência de "é página de produto?" usa os sinais que o
 * próprio HTML dá (og:type, microdata de oferta), nunca adivinhação.
 */
export const productSchema = {
  key: 'product-schema',
  evaluate(ctx) {
    const { nodes } = jsonLd(ctx);
    const produtos = nodes.filter((n) => typesOf(n).includes('product'));

    if (produtos.length === 0) {
      const ogType = (metaContent(ctx, 'og:type') || '').toLowerCase();
      const pareceProduto =
        ogType.includes('product') ||
        ctx.$('[itemtype*="schema.org/Product" i], [itemprop="offers"]').length > 0;
      if (!pareceProduto) {
        return { status: 'na', score: null, evidence: { reason: 'não é página de produto' } };
      }
      return {
        status: 'fail',
        score: 0,
        evidence: { produtos: 0, pareceProduto: true },
      };
    }

    // Basta um bloco completo: uma página de listagem traz vários produtos e
    // cobrar os três campos de TODOS reprovaria a página inteira por causa do
    // item mais pobre da lista.
    const completude = produtos.map((n) => ({
      name: Boolean(n.name),
      offers: Boolean(n.offers),
      aggregateRating: Boolean(n.aggregateRating),
    }));
    const melhor = completude.reduce(
      (a, c) => {
        const n = Number(c.name) + Number(c.offers) + Number(c.aggregateRating);
        return n > a.n ? { n, c } : a;
      },
      { n: -1, c: completude[0] },
    );

    let status = 'warn';
    let score = 0.5;
    if (melhor.n === 3) {
      status = 'pass';
      score = 1;
    } else if (melhor.n <= 1) {
      score = 0.3;
    }
    return {
      status,
      score,
      evidence: {
        produtos: produtos.length,
        campos: melhor.c,
        faltando: Object.entries(melhor.c)
          .filter(([, v]) => !v)
          .map(([k]) => k),
      },
    };
  },
};

/**
 * `rendering` — o que um bot de IA que NÃO executa JavaScript enxerga.
 *
 * Item do checklist do Igor (ata 4.10). Compara o texto do HTML cru com o do
 * HTML renderizado: se o conteúdo só existe depois do JS rodar, o motor que
 * não renderiza vê uma casca — e não cita o que não leu.
 *
 * Sem o HTML cru (a segunda busca é best-effort, ver context.js) o sinal se
 * declara NÃO MEDIDO em vez de reprovar: crédito de scraping esgotado não
 * pode virar nota baixa pro cliente.
 */
export const rendering = {
  key: 'rendering',
  evaluate(ctx) {
    if (!ctx.htmlCru) {
      return { status: 'na', score: null, evidence: { reason: 'HTML sem JS não foi obtido' } };
    }

    const $cru = cheerio.load(ctx.htmlCru);
    $cru('script, style, noscript, template, svg').remove();
    const textoCru = $cru('body').text().replace(/\s+/g, ' ').trim();
    const palavrasCru = textoCru ? textoCru.split(/\s+/).length : 0;
    const palavrasRender = ctx.wordCount || 0;

    // Página renderizada quase vazia não diz nada sobre dependência de JS.
    if (palavrasRender < 50) {
      return {
        status: 'na',
        score: null,
        evidence: { reason: 'página curta demais para comparar', palavrasRender },
      };
    }

    const share = palavrasCru / palavrasRender;
    let status = 'fail';
    let score = 0.2;
    if (share >= 0.8) {
      status = 'pass';
      score = 1;
    } else if (share >= 0.5) {
      status = 'warn';
      score = 0.6;
    }
    return {
      status,
      score,
      evidence: {
        palavrasSemJs: palavrasCru,
        palavrasComJs: palavrasRender,
        percentualVisivelSemJs: Math.round(share * 100),
      },
    };
  },
};

/**
 * `language-country` — a página declara em que idioma está e para quem.
 *
 * Outro item do checklist do Igor (ata 4.10). Sem `lang`, o motor adivinha o
 * idioma pelo texto e erra em página curta ou bilíngue; sem `hreflang` (ou ao
 * menos uma variante de região no próprio `lang`), ele não sabe que existe
 * versão para outro país — e a marca aparece na resposta errada, ou não
 * aparece na certa. É o caso `polar.com` × `polar.com/br` que o Q&A #2 pegou.
 */
export const languageCountry = {
  key: 'language-country',
  evaluate(ctx) {
    const lang = (ctx.$('html').attr('lang') || '').trim();
    const alternates = ctx
      .$('link[rel="alternate"][hreflang]')
      .map((_, el) => (ctx.$(el).attr('hreflang') || '').trim())
      .get()
      .filter(Boolean);
    // `pt-BR` já carrega o país; `pt` sozinho, não.
    const temRegiaoNoLang = /^[a-z]{2,3}-[a-z0-9]{2,}$/i.test(lang);

    let status = 'fail';
    let score = 0;
    if (lang && alternates.length > 0) {
      status = 'pass';
      score = 1;
    } else if (lang && temRegiaoNoLang) {
      status = 'pass';
      score = 0.9;
    } else if (lang) {
      status = 'warn';
      score = 0.5;
    }
    return {
      status,
      score,
      evidence: { lang: lang || null, hreflang: alternates.slice(0, 10), temRegiaoNoLang },
    };
  },
};

export const structureSignals = [
  structuralDepth,
  internalLinking,
  pageWeight,
  jsonLdPresence,
  jsonLdValidity,
  jsonLdRelevance,
  faqSchema,
  h1Quality,
  h2Coverage,
  lists,
  tables,
  altText,
  openGraph,
  sitemapPresence,
  productSchema,
  rendering,
  languageCountry,
];
