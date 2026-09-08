/**
 * Kit de citabilidade — o passo que faltava depois do diagnóstico.
 *
 * A auditoria já sabe dizer que falta `llms.txt`, que os bots de IA estão
 * bloqueados, que não há JSON-LD. O que ela não fazia era ENTREGAR: o cliente
 * lia "adicione um llms.txt" e continuava sem o arquivo. Este módulo fecha essa
 * distância — monta as peças prontas pra colar, com o caminho onde cada uma vai.
 *
 * Duas regras que definem o desenho:
 *
 * 1. NADA de chamada de LLM aqui. Tudo é montado do que a auditoria já leu da
 *    página (título, descrição, links internos, perfis sociais) e dos rascunhos
 *    que `recommendations.js` já produziu na passada única dele. O kit custa
 *    zero token, não depende de env nova e é testável linha a linha.
 *
 * 2. Nada é inventado. `sameAs` só lista perfil que existe na página; a
 *    descrição sai da própria página ou do rascunho da IA; o FAQ só nasce se a
 *    recomendação trouxe as perguntas. Peça sem matéria-prima real não é
 *    emitida — melhor faltar do que entregar ficção pro cliente publicar.
 *
 * Só emite peça pra sinal que FALHOU: quem já tem llms.txt não recebe llms.txt.
 */

const HOSTS_SOCIAIS = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'tiktok.com',
  'github.com',
  'pinterest.com',
];

/** Bots de IA que importam pro produto — os mesmos motores que o censo mede. */
const BOTS_DE_IA = [
  ['GPTBot', 'ChatGPT (treino e navegação)'],
  ['OAI-SearchBot', 'busca do ChatGPT'],
  ['ChatGPT-User', 'navegação em tempo real do ChatGPT'],
  ['ClaudeBot', 'Claude'],
  ['Claude-User', 'navegação em tempo real do Claude'],
  ['PerplexityBot', 'Perplexity'],
  ['Perplexity-User', 'navegação em tempo real do Perplexity'],
  ['Google-Extended', 'Gemini e AI Overviews'],
  ['Applebot-Extended', 'Apple Intelligence'],
  ['meta-externalagent', 'Meta AI'],
];

const LIMITE_PAGINAS = 12;

/** true quando o sinal existe no resultado e está falhando ou em alerta. */
function falhou(porChave, chave) {
  const r = porChave.get(chave);
  return Boolean(r && (r.status === 'fail' || r.status === 'warn'));
}

/** Rascunho que a IA já produziu pra um sinal, se houver. */
function rascunho(recomendacoes, chave) {
  const r = (recomendacoes || []).find((x) => x.signalKey === chave);
  return r?.draft ? String(r.draft).trim() : null;
}

/** Nome do site: og:site_name → <title> antes do separador → hostname. */
export function nomeDoSite(ctx) {
  const og = ctx.$('meta[property="og:site_name"]').attr('content');
  if (og && og.trim()) return og.trim();

  const titulo = (ctx.$('title').first().text() || '').trim();
  if (titulo) {
    // "Produto | Marca" e "Produto – Marca": o lado mais curto costuma ser a marca,
    // mas o primeiro pedaço é o que descreve a página. Ficamos com o primeiro.
    const pedaco = titulo.split(/\s[|–—·-]\s/)[0].trim();
    if (pedaco) return pedaco;
  }

  try {
    return new URL(ctx.origin).hostname.replace(/^www\./, '');
  } catch {
    return 'Site';
  }
}

/** Uma linha de resumo: rascunho da IA → meta description → 1ª frase do texto. */
export function resumoDoSite(ctx, recomendacoes) {
  const draft = rascunho(recomendacoes, 'meta-description');
  if (draft) return draft.replace(/\s+/g, ' ').slice(0, 200);

  const meta = ctx.$('meta[name="description"]').attr('content');
  if (meta && meta.trim()) return meta.trim().replace(/\s+/g, ' ').slice(0, 200);

  const frase = String(ctx.text || '')
    .split(/(?<=[.!?])\s/)[0]
    ?.trim();
  return frase ? frase.slice(0, 200) : '';
}

/**
 * Links internos que valem entrar no llms.txt: da navegação e do corpo, com
 * texto âncora legível, sem âncoras/mailto/tel, sem repetir o mesmo caminho e
 * sem a própria página.
 */
export function paginasInternas(ctx, limite = LIMITE_PAGINAS) {
  const vistos = new Set();
  const paginas = [];
  let atual = '';
  try {
    atual = new URL(ctx.url).pathname;
  } catch {
    atual = '';
  }

  ctx.$('a[href]').each((_, el) => {
    if (paginas.length >= limite) return false;

    const href = ctx.$(el).attr('href') || '';
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return undefined;

    let alvo;
    try {
      alvo = new URL(href, ctx.url);
    } catch {
      return undefined;
    }
    if (alvo.origin !== ctx.origin) return undefined;

    const caminho = alvo.pathname.replace(/\/+$/, '') || '/';
    if (caminho === (atual.replace(/\/+$/, '') || '/')) return undefined;
    if (caminho === '/') return undefined;
    if (vistos.has(caminho)) return undefined;

    const texto = (ctx.$(el).text() || '').replace(/\s+/g, ' ').trim();
    if (texto.length < 2 || texto.length > 80) return undefined;

    vistos.add(caminho);
    paginas.push({ titulo: texto, url: `${ctx.origin}${caminho}` });
    return undefined;
  });

  return paginas;
}

/** Perfis sociais REAIS encontrados na página — vira `sameAs`, sem inventar. */
export function perfisSociais(ctx) {
  const achados = new Set();
  ctx.$('a[href]').each((_, el) => {
    const href = ctx.$(el).attr('href') || '';
    let alvo;
    try {
      alvo = new URL(href, ctx.url);
    } catch {
      return undefined;
    }
    const host = alvo.hostname.replace(/^www\./, '');
    if (!HOSTS_SOCIAIS.some((h) => host === h || host.endsWith(`.${h}`))) return undefined;
    if (alvo.pathname === '/' || alvo.pathname === '') return undefined; // home da rede, não perfil
    achados.add(`${alvo.origin}${alvo.pathname.replace(/\/+$/, '')}`);
    return undefined;
  });
  return [...achados].slice(0, 8);
}

/**
 * Tira pares pergunta/resposta do rascunho da IA. Aceita as duas formas que o
 * modelo produz: um bloco JSON-LD FAQPage pronto, ou texto "P:/R:".
 */
export function extrairFaq(draft) {
  if (!draft) return [];

  // Forma 1: já veio um FAQPage montado (com ou sem cerca de markdown).
  const blocos = draft.match(/\{[\s\S]*\}/g) || [];
  for (const bloco of blocos) {
    try {
      const obj = JSON.parse(bloco);
      const itens = obj?.mainEntity;
      if (Array.isArray(itens) && itens.length) {
        const pares = itens
          .map((i) => ({
            pergunta: String(i?.name || '').trim(),
            resposta: String(i?.acceptedAnswer?.text || '').trim(),
          }))
          .filter((p) => p.pergunta && p.resposta);
        if (pares.length) return pares;
      }
    } catch {
      // segue pro próximo bloco / pro modo texto
    }
  }

  // Forma 2: texto com marcadores de pergunta e resposta.
  const pares = [];
  const linhas = draft.split('\n');
  let pergunta = null;
  for (const bruta of linhas) {
    const linha = bruta.replace(/^[\s*\-–>#]+/, '').trim();
    if (!linha) continue;
    const mP = linha.match(/^(?:P|Q|Pergunta|Question)\s*[:.]\s*(.+)$/i);
    const mR = linha.match(/^(?:R|A|Resposta|Answer)\s*[:.]\s*(.+)$/i);
    if (mP) {
      pergunta = mP[1].trim();
    } else if (mR && pergunta) {
      pares.push({ pergunta, resposta: mR[1].trim() });
      pergunta = null;
    } else if (!pergunta && /\?$/.test(linha)) {
      pergunta = linha;
    } else if (pergunta) {
      pares.push({ pergunta, resposta: linha });
      pergunta = null;
    }
  }
  return pares.filter((p) => p.pergunta && p.resposta).slice(0, 8);
}

function pecaLlmsTxt(ctx, recomendacoes) {
  const nome = nomeDoSite(ctx);
  const resumo = resumoDoSite(ctx, recomendacoes);
  const paginas = paginasInternas(ctx);

  const linhas = [`# ${nome}`, ''];
  if (resumo) linhas.push(`> ${resumo}`, '');
  if (paginas.length) {
    linhas.push('## Páginas principais', '');
    for (const p of paginas) linhas.push(`- [${p.titulo}](${p.url})`);
    linhas.push('');
  }

  return {
    id: 'llms-txt',
    titulo: 'llms.txt',
    onde: `${ctx.origin}/llms.txt — arquivo novo na raiz do site`,
    linguagem: 'markdown',
    conteudo: linhas.join('\n').trimEnd() + '\n',
    porque:
      'O site não publica llms.txt. É o índice que os modelos leem pra saber o que existe aqui e como descrever você — sem ele, cada motor adivinha a partir do HTML.',
    sinais: ['llms-txt-presence'],
    origem: 'deterministico',
  };
}

function pecaRobots(ctx) {
  const linhas = ['# Acesso dos rastreadores de IA — liberar leitura do conteúdo público', ''];
  for (const [bot, quem] of BOTS_DE_IA) {
    linhas.push(`# ${quem}`, `User-agent: ${bot}`, 'Allow: /', '');
  }

  return {
    id: 'robots-ia',
    titulo: 'Liberação dos bots de IA no robots.txt',
    onde: `${ctx.origin}/robots.txt — acrescentar ao final do arquivo existente`,
    linguagem: 'text',
    conteudo: linhas.join('\n').trimEnd() + '\n',
    porque:
      'Os rastreadores de IA estão bloqueados ou não têm regra explícita. Bloqueado, o motor não lê a página — e o que ele não lê, ele não cita.',
    sinais: ['ai-bot-access'],
    origem: 'deterministico',
  };
}

function pecaOrganization(ctx, marca) {
  const nome = marca?.name || nomeDoSite(ctx);
  const logo =
    ctx.$('meta[property="og:image"]').attr('content') ||
    ctx.$('link[rel="apple-touch-icon"]').attr('href') ||
    null;
  const sameAs = perfisSociais(ctx);

  const dados = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: nome,
    url: ctx.origin,
  };
  if (logo) {
    try {
      dados.logo = new URL(logo, ctx.url).toString();
    } catch {
      // logo relativo inválido: melhor omitir do que publicar link quebrado
    }
  }
  if (sameAs.length) dados.sameAs = sameAs;

  const json = JSON.stringify(dados, null, 2);

  return {
    id: 'jsonld-organization',
    titulo: 'JSON-LD da organização',
    onde: 'Dentro do <head> de todas as páginas',
    linguagem: 'html',
    conteudo: `<script type="application/ld+json">\n${json}\n</script>\n`,
    porque: sameAs.length
      ? 'A página não declara quem é a marca em dado estruturado. Este bloco liga nome, site e os perfis que já existem no seu rodapé numa entidade só — é assim que o modelo para de confundir você com homônimos.'
      : 'A página não declara quem é a marca em dado estruturado. Este bloco liga nome e site numa entidade só. Não achei perfis sociais na página; se existirem, acrescente-os em "sameAs" — é o que amarra a identidade.',
    sinais: ['json-ld-presence', 'brand-entity'],
    origem: 'deterministico',
  };
}

function pecaFaq(ctx, recomendacoes) {
  const pares = extrairFaq(rascunho(recomendacoes, 'faq-schema'));
  if (!pares.length) return null; // sem perguntas reais, não se inventa FAQ

  const dados = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pares.map((p) => ({
      '@type': 'Question',
      name: p.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: p.resposta },
    })),
  };

  return {
    id: 'jsonld-faq',
    titulo: `JSON-LD de FAQ (${pares.length} pergunta${pares.length > 1 ? 's' : ''})`,
    onde: 'No <head> da página, junto de uma seção de FAQ visível no HTML',
    linguagem: 'html',
    conteudo: `<script type="application/ld+json">\n${JSON.stringify(dados, null, 2)}\n</script>\n`,
    porque:
      'Pergunta e resposta em dado estruturado é o formato que os motores recortam direto pra resposta. As perguntas vieram do conteúdo da sua própria página — publique também a seção visível, senão o schema fica órfão.',
    sinais: ['faq-schema'],
    origem: 'rascunho-ia',
  };
}

function pecaMetaTags(ctx, recomendacoes, porChave) {
  const nome = nomeDoSite(ctx);
  const titulo = (ctx.$('title').first().text() || nome).trim();
  const descricao = resumoDoSite(ctx, recomendacoes);
  if (!descricao) return null;

  const imagem = ctx.$('meta[property="og:image"]').attr('content') || null;
  const linhas = [];

  if (falhou(porChave, 'meta-description')) {
    linhas.push(`<meta name="description" content="${escaparAtributo(descricao)}">`);
  }
  if (falhou(porChave, 'open-graph')) {
    linhas.push(
      `<meta property="og:title" content="${escaparAtributo(titulo)}">`,
      `<meta property="og:description" content="${escaparAtributo(descricao)}">`,
      `<meta property="og:url" content="${escaparAtributo(ctx.url)}">`,
      `<meta property="og:site_name" content="${escaparAtributo(nome)}">`,
      `<meta property="og:type" content="website">`,
    );
    if (imagem) linhas.push(`<meta property="og:image" content="${escaparAtributo(imagem)}">`);
  }
  if (falhou(porChave, 'twitter-card')) {
    linhas.push(
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escaparAtributo(titulo)}">`,
      `<meta name="twitter:description" content="${escaparAtributo(descricao)}">`,
    );
  }
  if (!linhas.length) return null;

  return {
    id: 'meta-tags',
    titulo: 'Bloco de meta tags',
    onde: 'Dentro do <head> desta página',
    linguagem: 'html',
    conteudo: linhas.join('\n') + '\n',
    porque:
      'A descrição curta é o texto que o motor reaproveita quando resume você em uma linha. Sem ela, ele recorta um pedaço qualquer do corpo da página.',
    sinais: ['meta-description', 'open-graph', 'twitter-card'].filter((s) => falhou(porChave, s)),
    origem: rascunho(recomendacoes, 'meta-description') ? 'rascunho-ia' : 'deterministico',
  };
}

/** Escapa aspas e < > pra o valor caber num atributo HTML sem quebrar a tag. */
export function escaparAtributo(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Monta o kit a partir de uma auditoria já rodada.
 *
 * @param {import('./context.js').AuditContext} ctx
 * @param {{
 *   results?: Array<{key:string,status:string,evidence?:object}>,
 *   recommendations?: Array<{signalKey:string,draft:string|null}>,
 *   marca?: {name?:string}|null,
 * }} opts
 * @returns {{ pecas: Array<object>, resumo: {total:number, deterministicas:number, comIa:number} }}
 */
export function montarKitCitabilidade(
  ctx,
  { results = [], recommendations = [], marca = null } = {},
) {
  const porChave = new Map((results || []).map((r) => [r.key, r]));
  const pecas = [];

  if (falhou(porChave, 'llms-txt-presence')) pecas.push(pecaLlmsTxt(ctx, recommendations));
  if (falhou(porChave, 'ai-bot-access')) pecas.push(pecaRobots(ctx));
  if (falhou(porChave, 'json-ld-presence') || falhou(porChave, 'brand-entity')) {
    pecas.push(pecaOrganization(ctx, marca));
  }
  if (falhou(porChave, 'faq-schema')) {
    const faq = pecaFaq(ctx, recommendations);
    if (faq) pecas.push(faq);
  }
  if (
    falhou(porChave, 'meta-description') ||
    falhou(porChave, 'open-graph') ||
    falhou(porChave, 'twitter-card')
  ) {
    const meta = pecaMetaTags(ctx, recommendations, porChave);
    if (meta) pecas.push(meta);
  }

  return {
    pecas,
    resumo: {
      total: pecas.length,
      deterministicas: pecas.filter((p) => p.origem === 'deterministico').length,
      comIa: pecas.filter((p) => p.origem === 'rascunho-ia').length,
    },
  };
}
