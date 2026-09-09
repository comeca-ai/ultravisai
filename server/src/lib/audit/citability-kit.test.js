import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  montarKitCitabilidade,
  nomeDoSite,
  resumoDoSite,
  paginasInternas,
  perfisSociais,
  extrairFaq,
  escaparAtributo,
} from './citability-kit.js';

/** Contexto mínimo de auditoria a partir de HTML — sem rede, igual audit.test.js. */
function ctxFromHtml(html, extra = {}) {
  const text = cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim();
  return {
    url: 'https://polar.com/br/produtos',
    origin: 'https://polar.com',
    protocol: 'https',
    statusCode: 200,
    html,
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    $: cheerio.load(html),
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
    robotsTxt: null,
    llmsTxt: null,
    now: Date.UTC(2026, 8, 7),
    ...extra,
  };
}

const PAGINA = `<!doctype html><html><head>
  <title>Relógios de corrida | Polar</title>
  <meta name="description" content="Relógios com medição de frequência cardíaca no pulso.">
  <meta property="og:image" content="/img/capa.png">
</head><body>
  <nav>
    <a href="/br/produtos">Produtos</a>
    <a href="/br/sobre">Sobre a Polar</a>
    <a href="/br/suporte/">Suporte</a>
    <a href="/br/sobre">Sobre a Polar</a>
    <a href="/">Home</a>
    <a href="#topo">Topo</a>
    <a href="mailto:oi@polar.com">E-mail</a>
    <a href="https://loja.exemplo.com/x">Parceiro</a>
  </nav>
  <main><p>A Polar mede frequência cardíaca desde 1977. Fundada na Finlândia.</p></main>
  <footer>
    <a href="https://www.instagram.com/polarglobal">Instagram</a>
    <a href="https://linkedin.com/company/polar/">LinkedIn</a>
    <a href="https://instagram.com/">Instagram genérico</a>
  </footer>
</body></html>`;

const falha = (key) => ({ key, status: 'fail', evidence: {} });
const passa = (key) => ({ key, status: 'pass', evidence: {} });

describe('leitura da página', () => {
  it('tira o nome do site do título antes do separador', () => {
    expect(nomeDoSite(ctxFromHtml(PAGINA))).toBe('Relógios de corrida');
  });

  it('prefere og:site_name quando existe', () => {
    const ctx = ctxFromHtml(
      '<html><head><meta property="og:site_name" content="Polar"><title>X | Y</title></head><body></body></html>',
    );
    expect(nomeDoSite(ctx)).toBe('Polar');
  });

  it('cai no hostname quando não há título nenhum', () => {
    expect(nomeDoSite(ctxFromHtml('<html><head></head><body></body></html>'))).toBe('polar.com');
  });

  it('usa a meta description como resumo, e o rascunho da IA quando houver', () => {
    const ctx = ctxFromHtml(PAGINA);
    expect(resumoDoSite(ctx, [])).toBe('Relógios com medição de frequência cardíaca no pulso.');
    const comDraft = [{ signalKey: 'meta-description', draft: 'Descrição nova e melhor.' }];
    expect(resumoDoSite(ctx, comDraft)).toBe('Descrição nova e melhor.');
  });

  it('sem meta nem rascunho, usa a primeira frase do corpo', () => {
    const ctx = ctxFromHtml(
      '<html><head></head><body><p>Primeira frase. Segunda.</p></body></html>',
    );
    expect(resumoDoSite(ctx, [])).toBe('Primeira frase.');
  });
});

describe('páginas internas do llms.txt', () => {
  const paginas = paginasInternas(ctxFromHtml(PAGINA));

  it('mantém só links internos, sem repetir caminho', () => {
    expect(paginas.map((p) => p.url)).toEqual([
      'https://polar.com/br/sobre',
      'https://polar.com/br/suporte',
    ]);
  });

  it('descarta a própria página, a home, âncora, mailto e domínio externo', () => {
    const urls = paginas.map((p) => p.url).join(' ');
    expect(urls).not.toContain('/br/produtos'); // é a página auditada
    expect(urls).not.toContain('loja.exemplo.com');
    expect(urls).not.toMatch(/#|mailto/);
    expect(paginas.some((p) => p.url === 'https://polar.com/')).toBe(false);
  });

  it('respeita o limite', () => {
    expect(paginasInternas(ctxFromHtml(PAGINA), 1)).toHaveLength(1);
  });
});

describe('perfis sociais', () => {
  it('coleta perfis reais e ignora a home da rede', () => {
    expect(perfisSociais(ctxFromHtml(PAGINA))).toEqual([
      'https://www.instagram.com/polarglobal',
      'https://linkedin.com/company/polar',
    ]);
  });
});

describe('extrairFaq', () => {
  it('lê um FAQPage JSON-LD já montado pelo rascunho', () => {
    const draft = `Segue o bloco:
\`\`\`json
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":"Mede FC no pulso?","acceptedAnswer":{"@type":"Answer","text":"Sim, em todos os modelos."}}
]}
\`\`\``;
    expect(extrairFaq(draft)).toEqual([
      { pergunta: 'Mede FC no pulso?', resposta: 'Sim, em todos os modelos.' },
    ]);
  });

  it('lê pares em texto com marcadores P:/R:', () => {
    const draft = '- P: Qual a autonomia?\n- R: Até 100 horas.\nP: Tem GPS?\nR: Sim.';
    expect(extrairFaq(draft)).toEqual([
      { pergunta: 'Qual a autonomia?', resposta: 'Até 100 horas.' },
      { pergunta: 'Tem GPS?', resposta: 'Sim.' },
    ]);
  });

  it('lê pergunta terminada em "?" seguida da resposta na linha de baixo', () => {
    expect(extrairFaq('É à prova d água?\nSim, até 50 metros.')).toEqual([
      { pergunta: 'É à prova d água?', resposta: 'Sim, até 50 metros.' },
    ]);
  });

  it('devolve vazio sem rascunho e não quebra com JSON inválido', () => {
    expect(extrairFaq(null)).toEqual([]);
    expect(extrairFaq('{ isso não é json }')).toEqual([]);
  });
});

describe('montarKitCitabilidade', () => {
  it('não entrega nada quando a página já passa em tudo', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [passa('llms-txt-presence'), passa('ai-bot-access'), passa('json-ld-presence')],
    });
    expect(kit.pecas).toEqual([]);
    expect(kit.resumo.total).toBe(0);
  });

  it('gera llms.txt com nome, resumo e as páginas internas', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [falha('llms-txt-presence')],
    });
    const peca = kit.pecas.find((p) => p.id === 'llms-txt');
    expect(peca.conteudo).toContain('# Relógios de corrida');
    expect(peca.conteudo).toContain('> Relógios com medição de frequência cardíaca no pulso.');
    expect(peca.conteudo).toContain('- [Sobre a Polar](https://polar.com/br/sobre)');
    expect(peca.onde).toContain('/llms.txt');
    expect(peca.origem).toBe('deterministico');
  });

  it('gera o bloco de robots com os bots dos motores que o censo mede', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), { results: [falha('ai-bot-access')] });
    const peca = kit.pecas.find((p) => p.id === 'robots-ia');
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(peca.conteudo).toContain(`User-agent: ${bot}`);
    }
    expect(peca.conteudo).toContain('Allow: /');
  });

  it('gera Organization com sameAs só dos perfis achados e logo absoluto', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [falha('json-ld-presence')],
      marca: { name: 'Polar Electro' },
    });
    const peca = kit.pecas.find((p) => p.id === 'jsonld-organization');
    const json = JSON.parse(peca.conteudo.replace(/<\/?script[^>]*>/g, '').trim());
    expect(json.name).toBe('Polar Electro');
    expect(json.url).toBe('https://polar.com');
    expect(json.logo).toBe('https://polar.com/img/capa.png');
    expect(json.sameAs).toContain('https://www.instagram.com/polarglobal');
  });

  it('omite sameAs e avisa quando a página não tem perfil social', () => {
    const ctx = ctxFromHtml('<html><head><title>Marca</title></head><body><p>oi</p></body></html>');
    const kit = montarKitCitabilidade(ctx, { results: [falha('brand-entity')] });
    const peca = kit.pecas.find((p) => p.id === 'jsonld-organization');
    expect(
      JSON.parse(peca.conteudo.replace(/<\/?script[^>]*>/g, '').trim()).sameAs,
    ).toBeUndefined();
    expect(peca.porque).toContain('Não achei perfis sociais');
  });

  it('NÃO inventa FAQ quando o rascunho não trouxe perguntas', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), { results: [falha('faq-schema')] });
    expect(kit.pecas.find((p) => p.id === 'jsonld-faq')).toBeUndefined();
  });

  it('gera FAQPage válido quando o rascunho trouxe perguntas', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [falha('faq-schema')],
      recommendations: [{ signalKey: 'faq-schema', draft: 'P: Tem GPS?\nR: Sim, em todos.' }],
    });
    const peca = kit.pecas.find((p) => p.id === 'jsonld-faq');
    const json = JSON.parse(peca.conteudo.replace(/<\/?script[^>]*>/g, '').trim());
    expect(json['@type']).toBe('FAQPage');
    expect(json.mainEntity[0].name).toBe('Tem GPS?');
    expect(json.mainEntity[0].acceptedAnswer.text).toBe('Sim, em todos.');
    expect(peca.origem).toBe('rascunho-ia');
  });

  it('monta o bloco de meta só com as tags dos sinais que falharam', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [falha('meta-description'), passa('open-graph'), passa('twitter-card')],
    });
    const peca = kit.pecas.find((p) => p.id === 'meta-tags');
    expect(peca.conteudo).toContain('<meta name="description"');
    expect(peca.conteudo).not.toContain('og:title');
    expect(peca.conteudo).not.toContain('twitter:card');
    expect(peca.sinais).toEqual(['meta-description']);
  });

  it('escapa aspas no valor das meta tags', () => {
    const ctx = ctxFromHtml(
      '<html><head><title>A</title><meta name="description" content=\'Relógio "Pro" & cia\'></head><body></body></html>',
    );
    const kit = montarKitCitabilidade(ctx, { results: [falha('meta-description')] });
    const peca = kit.pecas.find((p) => p.id === 'meta-tags');
    expect(peca.conteudo).toContain('&quot;Pro&quot;');
    expect(peca.conteudo).toContain('&amp;');
    expect(escaparAtributo('<b>')).toBe('&lt;b&gt;');
  });

  it('sitemap: entrega o arquivo com as URLs lidas e a linha do robots', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [{ key: 'sitemap-presence', status: 'fail', evidence: { existe: false } }],
    });
    const peca = kit.pecas.find((p) => p.id === 'sitemap');
    expect(peca.conteudo).toContain('<urlset');
    expect(peca.conteudo).toContain('https://polar.com/br/sobre');
    expect(peca.conteudo).toContain('Sitemap: https://polar.com/sitemap.xml');
    // A home entra sempre; link externo e âncora, nunca.
    expect(peca.conteudo).toContain('<loc>https://polar.com/</loc>');
    expect(peca.conteudo).not.toContain('loja.exemplo.com');
  });

  it('sitemap: quando o arquivo já existe, entrega só a linha do robots', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [
        {
          key: 'sitemap-presence',
          status: 'warn',
          evidence: { existe: true, declaradoNoRobots: false },
        },
      ],
    });
    const peca = kit.pecas.find((p) => p.id === 'sitemap-robots');
    expect(peca.conteudo.trim()).toBe('Sitemap: https://polar.com/sitemap.xml');
    expect(kit.pecas.find((p) => p.id === 'sitemap')).toBeUndefined();
  });

  it('product: monta o bloco com o que a página tem e não inventa preço', () => {
    const html = `<html><head>
      <meta property="og:title" content="Polar Vantage V3">
      <meta name="description" content="Relógio com GPS duplo.">
      <meta property="og:type" content="product">
    </head><body><h1>Polar Vantage V3</h1></body></html>`;
    const kit = montarKitCitabilidade(ctxFromHtml(html), {
      results: [falha('product-schema')],
      marca: { name: 'Polar' },
    });
    const peca = kit.pecas.find((p) => p.id === 'jsonld-product');
    const dados = JSON.parse(peca.conteudo.replace(/<\/?script[^>]*>/g, '').trim());

    expect(dados['@type']).toBe('Product');
    expect(dados.name).toBe('Polar Vantage V3');
    expect(dados.brand).toEqual({ '@type': 'Brand', name: 'Polar' });
    // Sem preço na página, `offers` NÃO é inventado — vira instrução no texto.
    expect(dados.offers).toBeUndefined();
    expect(peca.porque).toContain('offers');
    expect(peca.porque).toContain('aggregateRating');
  });

  it('product: usa o preço real quando a página publica', () => {
    const html = `<html><head>
      <meta property="og:title" content="Polar Grit X2">
      <meta property="product:price:amount" content="4999.00">
      <meta property="product:price:currency" content="BRL">
    </head><body></body></html>`;
    const kit = montarKitCitabilidade(ctxFromHtml(html), { results: [falha('product-schema')] });
    const peca = kit.pecas.find((p) => p.id === 'jsonld-product');
    const dados = JSON.parse(peca.conteudo.replace(/<\/?script[^>]*>/g, '').trim());
    expect(dados.offers).toEqual({
      '@type': 'Offer',
      price: '4999.00',
      priceCurrency: 'BRL',
      url: 'https://polar.com/br/produtos',
    });
  });

  it('product: sem nome na página, não emite peça', () => {
    const kit = montarKitCitabilidade(ctxFromHtml('<html><head></head><body></body></html>'), {
      results: [falha('product-schema')],
    });
    expect(kit.pecas.find((p) => p.id === 'jsonld-product')).toBeUndefined();
  });

  it('conta as peças por origem no resumo', () => {
    const kit = montarKitCitabilidade(ctxFromHtml(PAGINA), {
      results: [falha('llms-txt-presence'), falha('ai-bot-access'), falha('faq-schema')],
      recommendations: [{ signalKey: 'faq-schema', draft: 'P: Tem GPS?\nR: Sim.' }],
    });
    expect(kit.resumo).toEqual({ total: 3, deterministicas: 2, comIa: 1 });
  });
});
