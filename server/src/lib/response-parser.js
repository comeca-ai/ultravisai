/**
 * Parses an AI response to extract brand visibility metrics.
 * Mentions and citations are computed locally; sentiment comes from AI.
 */

/**
 * Strip markdown link URLs so only display text remains.
 * "[label](https://example.com/path)" → "label"
 * Also removes bare URLs (https://...) that aren't inside markdown links.
 */
function stripUrls(text) {
  let cleaned = text.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/https?:\/\/[^\s)>\]]+/g, '');
  return cleaned;
}

/**
 * Count case-insensitive occurrences of a term in text.
 */
function countOccurrences(text, term) {
  if (!term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
  return (text.match(regex) || []).length;
}

/**
 * Normalized hostname of a URL ("https://www.FOO.com/bar" → "foo.com").
 * Mirrors extractHostname in web/src/lib/citations/classify.ts — keep the two
 * in sync: citation_count must agree with the Citations page's read-time
 * classification, or the same metric shows different numbers per surface.
 */
export function extractHostname(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(String(rawUrl).trim());
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host || null;
  } catch {
    const match = String(rawUrl).match(/^(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

/**
 * Count the citations that point at one of the brand's own domains: exact
 * host or subdomain match, same rule as the web classifier's 'you' category.
 * The old substring check (url.includes(domain)) also matched the brand's
 * domain inside another site's path or query string, and disagreed with the
 * Citations page over www/subdomain variants.
 */
export function countOwnDomainCitations(citations, brandDomains) {
  const normalized = (brandDomains || [])
    .map(
      (d) =>
        extractHostname(d) ??
        String(d ?? '')
          .trim()
          .toLowerCase(),
    )
    .filter(Boolean);
  if (normalized.length === 0) return 0;

  let count = 0;
  for (const cite of citations || []) {
    const host = extractHostname(cite?.url || '');
    if (host && normalized.some((d) => host === d || host.endsWith(`.${d}`))) {
      count++;
    }
  }
  return count;
}

/**
 * Normaliza texto pra comparação de termo de marca: minúsculas, sem acento e
 * com os separadores de slug virando espaço, pra que `polar-vantage-v3` e
 * "Polar Vantage V3" fiquem comparáveis.
 */
export function normalizarParaBusca(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_+./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Termo aparece como PALAVRA INTEIRA no texto normalizado. */
function temTermoInteiro(textoNormalizado, termo) {
  const alvo = normalizarParaBusca(termo);
  if (!alvo) return false;
  const escapado = alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapado}\\b`).test(textoNormalizado);
}

/**
 * A citação "traz claramente o produto"? — definição do dono (07/set):
 *
 *   "A citação é a quantidade de vezes que ele trouxe seu link nos prompts
 *    avaliados. O link pode ser de outras fontes, mas tem que ter claramente
 *    o produto."
 *
 * Decide sem buscar a página: `url` e `title` já vêm gravados em cada citação,
 * então a regra é barata, determinística e retroativa sobre o histórico
 * inteiro — do mesmo jeito que o `appearance_rank` foi calculado pra trás.
 *
 * O risco é marca de nome comum: "Polar" também é urso polar e vórtice polar.
 * Duas proteções: palavra inteira SEMPRE, e `citation_terms` por marca — quem
 * tem nome genérico cadastra "Polar Vantage", "Polar Grit" e a regra passa a
 * exigir o termo composto. Sem `citation_terms`, cai no nome + aliases.
 */
export function citacaoTrazOProduto(cite, termos) {
  const lista = (termos || []).filter(Boolean);
  if (lista.length === 0) return false;

  const titulo = normalizarParaBusca(cite?.title || '');
  if (lista.some((t) => temTermoInteiro(titulo, t))) return true;

  // Só o CAMINHO da URL: nem o host, nem a query.
  //  - host: já é decidido pelo domínio da marca; olhar duas vezes faria
  //    "polar.com" contar em dobro;
  //  - query: `?ref=polar.com` e `?utm_source=polar` são parâmetro de
  //    rastreamento, não link de produto — contá-los infla o número com
  //    exatamente o tipo de falso positivo que a regra tenta evitar.
  let caminho = '';
  try {
    const u = new URL(String(cite?.url || '').trim());
    caminho = u.pathname;
  } catch {
    caminho = String(cite?.url || '')
      .replace(/^[a-z]+:\/\/[^/]+/i, '')
      .split('?')[0];
  }
  const slug = normalizarParaBusca(caminho);
  return lista.some((t) => temTermoInteiro(slug, t));
}

/**
 * Conta as citações que valem pra marca, separadas por origem.
 *
 * Separadas, e não somadas num número só, porque as duas pedem ação
 * diferente: no domínio próprio a IA foi buscar na SUA página (mantenha-a
 * citável); em fonte de terceiro alguém falou de você e a IA usou
 * (assessoria, review, comparativo). `total` é o número que o dono definiu
 * como "citação"; a quebra é o que diz o que fazer com ele.
 */
export function contarCitacoesDoProduto(citations, { domains = [], termos = [] } = {}) {
  const proprias = countOwnDomainCitations(citations, domains);

  const normalizados = (domains || [])
    .map(
      (d) =>
        extractHostname(d) ??
        String(d ?? '')
          .trim()
          .toLowerCase(),
    )
    .filter(Boolean);

  let terceiros = 0;
  for (const cite of citations || []) {
    const host = extractHostname(cite?.url || '');
    const ehPropria = host && normalizados.some((d) => host === d || host.endsWith(`.${d}`));
    if (ehPropria) continue; // já contada em `proprias`, não conta duas vezes
    if (citacaoTrazOProduto(cite, termos)) terceiros++;
  }

  return { total: proprias + terceiros, proprias, terceiros };
}

/**
 * Count how many times the brand (name or any of its domains) is mentioned
 * in an AI response. URL-stripped to avoid double-counting citations.
 * Used to short-circuit sentiment analysis when the brand isn't mentioned.
 */
export function countBrandMentions(text, brand) {
  const cleanText = stripUrls(text);
  let count = countOccurrences(cleanText, brand.brandName);
  for (const domain of brand.domains) {
    count += countOccurrences(cleanText, domain);
  }
  // Ultravis: aliases count as brand mentions — corporate names ("Polar
  // Electro") rarely appear verbatim in AI answers that say "Polar".
  for (const alias of brand.aliases || []) {
    count += countOccurrences(cleanText, alias);
  }
  return count;
}

/**
 * Parse the AI response and compute visibility metrics for a brand.
 * Sentiment must be provided externally (from AI analysis).
 * @param {{ text: string, citations: Array<{ url: string, title: string, startIndex: number, endIndex: number }> }} response
 * @param {{ brandName: string, domains: string[], aliases?: string[], citationTerms?: string[] }} brand
 * @param {'positive'|'neutral'|'negative'} sentiment - AI-analyzed sentiment
 * @param {Array<{ id: string, name: string, domain: string }>} [competitors] - Optional competitor list
 * @returns {{ mentionCount: number, citationCount: number, citationOwnCount: number, citationThirdPartyCount: number, sentiment: string, visibilityScore: number, competitorMentions: Array }}
 */
export function parseResponse(response, brand, sentiment = 'neutral', competitors = []) {
  const { text, citations } = response;
  const cleanText = stripUrls(text);

  // --- Brand mention count (on URL-stripped text to avoid double-counting) ---
  let mentionCount = countOccurrences(cleanText, brand.brandName);
  for (const domain of brand.domains) {
    mentionCount += countOccurrences(cleanText, domain);
  }
  // Ultravis: aliases (see countBrandMentions).
  for (const alias of brand.aliases || []) {
    mentionCount += countOccurrences(cleanText, alias);
  }

  // --- Citações da marca (ajustar.md Parte 3, decisão do dono de 07/set) ---
  // Conta domínio próprio E link de terceiro que traga claramente o produto.
  // `citationTerms` só existe pra marca de nome genérico; sem ele, nome +
  // aliases, que é o que a marca já cadastrou.
  const termosDeCitacao =
    brand.citationTerms && brand.citationTerms.length > 0
      ? brand.citationTerms
      : [brand.brandName, ...(brand.aliases || [])];
  const citacoes = contarCitacoesDoProduto(citations, {
    domains: brand.domains,
    termos: termosDeCitacao,
  });
  const citationCount = citacoes.total;

  // --- Visibility Score (0-100) ---
  const visibilityScore = computeVisibilityScore({
    mentionCount,
    citationCount,
    totalCitations: citations.length,
    sentiment,
  });

  // --- Competitor mentions (on URL-stripped text) ---
  const competitorMentions = competitors.map((comp) => {
    let compMentions = countOccurrences(cleanText, comp.name);
    if (comp.domain) {
      compMentions += countOccurrences(cleanText, comp.domain);
    }

    let compCitations = 0;
    if (comp.domain) {
      for (const cite of citations) {
        const url = (cite.url || '').toLowerCase();
        if (url.includes(comp.domain.toLowerCase())) {
          compCitations++;
        }
      }
    }

    const compScore = computeVisibilityScore({
      mentionCount: compMentions,
      citationCount: compCitations,
      totalCitations: citations.length,
      sentiment: 'neutral',
    });

    return {
      competitor_id: comp.id,
      name: comp.name,
      domain: comp.domain || '',
      mention_count: compMentions,
      citation_count: compCitations,
      visibility_score: compScore,
    };
  });

  return {
    mentionCount,
    citationCount,
    // A quebra não vai pro banco: a página de Citações recalcula na leitura a
    // partir do JSONB `citations`, que já guarda url e title. Coluna nova só
    // pra isso seria um segundo lugar pra desalinhar — que é exatamente o
    // problema que a Parte 1 do ajustar.md documenta.
    citationOwnCount: citacoes.proprias,
    citationThirdPartyCount: citacoes.terceiros,
    sentiment,
    visibilityScore,
    competitorMentions,
  };
}

/**
 * Compute a 0-100 visibility score based on multiple signals.
 */
function computeVisibilityScore({ mentionCount, citationCount, totalCitations, sentiment }) {
  let score = 0;

  // Mention component (max 40 pts): each mention = 10pts, capped at 4+
  score += Math.min(mentionCount * 10, 40);

  // Citation component (max 30 pts): each citation = 15pts, capped at 2+
  score += Math.min(citationCount * 15, 30);

  // Citation ratio bonus (max 15 pts): brand citations / total citations
  if (totalCitations > 0) {
    score += Math.round((citationCount / totalCitations) * 15);
  }

  // Sentiment bonus (max 15 pts)
  if (sentiment === 'positive') score += 15;
  else if (sentiment === 'neutral' && mentionCount > 0) score += 7;

  return Math.min(score, 100);
}
