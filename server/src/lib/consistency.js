/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Consistency sweep ("vigia de contas e nomes"): deterministic invariants over
 * the platform's own data, born from five bugs caught by hand in a single week
 * (19/ago) — a duplicated competitor summing to 178% in a chart, two
 * near-identical brands splitting one client's numbers, per-engine bars that
 * didn't match the totals, and a brand whose prompts spelled its name in a
 * way the parser didn't recognize. Each check below names the incident family
 * it guards against.
 *
 * Same contract as watchdog.js: a pure `evaluateConsistency(snap, now)` over a
 * data snapshot (unit-testable without a database) plus a best-effort
 * `collectConsistencySnapshot()`. The watchdog merges these alerts into its
 * 15-min cycle, so findings reach /ops and the alert channels with the same
 * anti-spam window — no new cron, no new delivery path.
 *
 * Layer 2 (weekly LLM pass over the consolidated screen numbers) is designed
 * but gated on a valid ANTHROPIC_API_KEY — see BACKLOG.md.
 */

import logger from './logger.js';
import { countBrandMentions } from './response-parser.js';

/** Results window: weekly census cadence + 1 day of slack (same as watchdog). */
const WINDOW_DAYS = 8;
/** A brand needs this many rows in the window before engine-silence is judged. */
const ENGINE_MIN_ROWS = 10;
/**
 * Appearance-rank sweep drains 200 rows per 30-min run (400/h); a weekly
 * census can legitimately take a few hours to drain. Only rows older than
 * this count as a STALLED sweep (auditor finding, 19/ago: 2h alarmava a
 * drenagem normal de segunda-feira).
 */
const RANK_STALL_HOURS = 6;
/** Recount drift alerts only when both thresholds are crossed (avoid noise). */
const RECOUNT_MIN_ROWS = 3;
const RECOUNT_MIN_SHARE = 0.1;
/** Sentiment values the pipeline is allowed to write. */
const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

/**
 * Espelho de resolveModelPlatform (tracking-worker.js): motores de API são
 * configurados em prompts.models e gravam platform 'claude'/'gemini'/'chatgpt'
 * — sem este espelho, o vigia não enxerga o caso Claude (achado da revisão
 * de 19/ago).
 */
function modelPlatform(model) {
  const m = String(model ?? '');
  if (m.startsWith('claude-')) return 'claude';
  if (m.startsWith('gemini-')) return 'gemini';
  return 'chatgpt';
}

/**
 * Pesos-default do IC — ESPELHO de INDEX_DIMENSIONS em
 * web/src/config/visibility-index.ts (mudanças valem nos dois). A tabela
 * index_weights pode ser PARCIAL: o app faz merge das linhas sobre estes
 * defaults, então a soma que importa é a EFETIVA (achado da revisão de
 * 19/ago: somar só as linhas dava falso crítico e falso negativo).
 */
const IC_DEFAULT_WEIGHTS = { dim1: 15, dim2: 20, dim3: 12, dim4: 18, dim5: 22, dim6: 13 };

/**
 * Shopping tem pipeline e semântica próprios (isolado do Insights, #155):
 * o worker mantém 'chatgpt-shopping' em prompts.platforms mesmo com o modo
 * desligado na marca — fora dos checks de motor para não gritar em falso.
 */
const SHOPPING_PLATFORM = 'chatgpt-shopping';

/** Lowercase, strip diacritics, collapse whitespace — "Ana  Coutô" → "ana couto". */
export function normalizeName(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hostname normalizado — ESPELHO de extractHostname (response-parser.js e
 * web/src/lib/citations/classify.ts): tira protocolo, "www." e caminho.
 * null quando não sobra host nenhum.
 */
function hostOf(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    const h = u.hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h || null;
  } catch {
    const m = v.match(/^(?:https?:\/\/)?(?:www\.)?([^/\s?#]+)/i);
    return m ? m[1].toLowerCase() : null;
  }
}

/** True when the shorter name's words are a prefix of the longer's ("polar" ⊂ "polar electro"). */
function isWordPrefix(shorter, longer) {
  const a = shorter.split(' ');
  const b = longer.split(' ');
  if (a.length >= b.length) return false;
  return a.every((w, i) => w === b[i]);
}

/**
 * Pure evaluation of the consistency snapshot. Returns alerts in the
 * watchdog's shape: `{ key, severity: 'critical'|'warning', message }`.
 *
 * @param {{
 *   brands: { id: string, organizationId: string, name: string, aliases: string[], isActive: boolean }[],
 *   competitors: { brandId: string, name: string, domain: string }[],
 *   brandDomains: { brandId: string, domain: string }[],
 *   indexWeights: { dimKey: string, weight: number }[],
 *   prompts: { brandId: string|null, platforms: string[], models: string[], text: string, isBrandPrompt: boolean }[],
 *   recentResults: { brandId: string, platform: string|null, mentionCount: number, citationCount: number, appearanceRank: number|null, sentiment: string }[],
 *   stalledRankRows: number,
 *   recountSample: { total: number, divergent: number },
 * }} snap
 * @param {Date} _now — reservado (checks atuais são atemporais; janelas ficam na coleta)
 */
export function evaluateConsistency(snap, _now) {
  const alerts = [];
  const brandName = new Map(snap.brands.map((b) => [b.id, b.name]));

  // ── Família "nomes e duplicatas" ──────────────────────────────────────────

  // Caso Garmin (18/ago): dois concorrentes homônimos na mesma marca somavam
  // as menções e a barrinha passava de 100%. Pega no dia do cadastro.
  {
    const byBrand = new Map();
    for (const c of snap.competitors) {
      const key = `${c.brandId}::${normalizeName(c.name)}`;
      byBrand.set(key, (byBrand.get(key) ?? 0) + 1);
    }
    const dups = [...byBrand.entries()].filter(([, n]) => n > 1);
    if (dups.length > 0) {
      const detail = dups
        .slice(0, 5)
        .map(([key, n]) => {
          const [brandId, name] = key.split('::');
          return `"${name}" ×${n} em ${brandName.get(brandId) ?? brandId}`;
        })
        .join(' · ');
      alerts.push({
        key: 'consistency-dup-competitors',
        severity: 'critical',
        message: `Concorrente duplicado na mesma marca (soma menções em dobro — caso Garmin): ${detail}. Apagar a duplicata em Concorrentes.`,
      });
    }
  }

  // Caso Polar (18/ago): duas marcas quase-idênticas na mesma organização
  // dividem os números entre si e nenhuma tela fecha com a outra.
  {
    const active = snap.brands.filter((b) => b.isActive);
    const byOrg = new Map();
    for (const b of active) {
      const list = byOrg.get(b.organizationId) ?? [];
      list.push(b);
      byOrg.set(b.organizationId, list);
    }
    const pairs = [];
    for (const list of byOrg.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = normalizeName(list[i].name);
          const b = normalizeName(list[j].name);
          if (a === b || isWordPrefix(a, b) || isWordPrefix(b, a)) {
            pairs.push(`"${list[i].name}" × "${list[j].name}"`);
          }
        }
      }
    }
    if (pairs.length > 0) {
      alerts.push({
        key: 'consistency-sibling-brands',
        severity: 'warning',
        message: `Marcas quase-idênticas ativas na mesma organização (dividem os números — caso Polar): ${pairs.slice(0, 5).join(' · ')}. Consolidar ou arquivar uma delas.`,
      });
    }
  }

  // Domínio cadastrado de forma que o classificador de citações não consegue
  // usar como pretendido.
  //
  // ATENÇÃO (verificação de 26/ago): "www." e protocolo NÃO são problema —
  // extractHostname normaliza os dois, e a contagem de citação própria bate
  // igual ("www.polar.com" e "https://www.polar.com/br" contam as mesmas
  // citações que "polar.com", provado em teste). A versão anterior deste
  // check afirmava que "citações próprias deixam de contar" e acusava o
  // domínio do cliente todos os dias — alerta falso. Ficam só os dois casos
  // que realmente mudam o resultado:
  //   (a) o domínio não normaliza para hostname nenhum (erro de cadastro);
  //   (b) o domínio tem CAMINHO — a comparação usa só o host, então qualquer
  //       link daquele host passa a contar como seu (ex.: um link de
  //       agregador vira "linktr.ee" inteiro).
  {
    const broken = [];
    const pathed = [];
    const check = (label, raw) => {
      const d = String(raw ?? '').trim();
      if (!d) return;
      const host = hostOf(d);
      if (!host) {
        broken.push(`${label}: "${d}"`);
        return;
      }
      const afterHost = d.replace(/^https?:\/\//i, '').slice(host.replace(/^www\./, '').length);
      if (/\/\S/.test(afterHost) || /\s/.test(d)) pathed.push(`${label}: "${d}" → ${host}`);
    };
    for (const d of snap.brandDomains) check(brandName.get(d.brandId) ?? d.brandId, d.domain);
    for (const c of snap.competitors) {
      check(`${brandName.get(c.brandId) ?? c.brandId} (conc. ${c.name})`, c.domain);
    }
    if (broken.length > 0) {
      alerts.push({
        key: 'consistency-broken-domains',
        severity: 'warning',
        message: `Domínio cadastrado que não vira hostname nenhum (citações desse domínio nunca contam): ${broken.slice(0, 5).join(' · ')}. Corrigir o cadastro.`,
      });
    }
    if (pathed.length > 0) {
      alerts.push({
        key: 'consistency-pathed-domains',
        severity: 'warning',
        message: `Domínio cadastrado com caminho — a comparação usa só o host, então QUALQUER link desse host conta como seu: ${pathed.slice(0, 5).join(' · ')}. Cadastrar só o domínio próprio.`,
      });
    }
  }

  // Caso Anacouto (17/ago): prompt de marca cuja grafia não bate com
  // nome/alias/domínio — o parser nunca acha a marca na resposta.
  {
    const termsByBrand = new Map();
    for (const b of snap.brands) {
      const terms = [b.name, ...(b.aliases ?? [])].map(normalizeName).filter(Boolean);
      for (const d of snap.brandDomains.filter((x) => x.brandId === b.id)) {
        const host = normalizeName(d.domain).replace(/^www\./, '');
        if (host) terms.push(host);
      }
      termsByBrand.set(b.id, terms);
    }
    const misses = new Map();
    for (const p of snap.prompts) {
      if (!p.isBrandPrompt || !p.brandId) continue;
      const terms = termsByBrand.get(p.brandId) ?? [];
      if (terms.length === 0) continue;
      const text = normalizeName(p.text);
      if (!terms.some((t) => text.includes(t))) {
        misses.set(p.brandId, (misses.get(p.brandId) ?? 0) + 1);
      }
    }
    if (misses.size > 0) {
      const detail = [...misses.entries()]
        .slice(0, 5)
        .map(([id, n]) => `${brandName.get(id) ?? id}: ${n} prompt(s)`)
        .join(' · ');
      alerts.push({
        key: 'consistency-brand-prompt-no-term',
        severity: 'warning',
        message: `Prompt de marca sem nenhuma grafia conhecida da marca (nome/alias/domínio — caso Anacouto): ${detail}. Adicionar alias na marca ou corrigir o prompt.`,
      });
    }
  }

  // ── Família "pesos e config" ──────────────────────────────────────────────

  // Os pesos EFETIVOS do IC devem somar 100 — a tabela pode ser parcial e o
  // app faz merge sobre os defaults; é a soma pós-merge que a tela usa.
  if (snap.indexWeights.length > 0) {
    const effective = { ...IC_DEFAULT_WEIGHTS };
    for (const w of snap.indexWeights) {
      if (w.dimKey in effective) effective[w.dimKey] = w.weight ?? 0;
    }
    const sum = Object.values(effective).reduce((s, v) => s + v, 0);
    if (sum !== 100) {
      alerts.push({
        key: 'consistency-index-weights-sum',
        severity: 'critical',
        message: `Pesos efetivos do Índice de Citabilidade somam ${sum}, não 100 (linhas da tabela aplicadas sobre os defaults) — corrigir em /ops (index_weights).`,
      });
    }
  }

  // Teria pego Grok e Claude sozinho: motor configurado nos prompts de uma
  // marca cujo censo RODOU na janela (outros motores entregaram), mas que não
  // entregou nenhuma linha.
  {
    const rowsByBrand = new Map();
    for (const r of snap.recentResults) {
      const entry = rowsByBrand.get(r.brandId) ?? { total: 0, platforms: new Set() };
      entry.total += 1;
      if (r.platform) entry.platforms.add(r.platform);
      rowsByBrand.set(r.brandId, entry);
    }
    const configured = new Map();
    for (const p of snap.prompts) {
      if (!p.brandId) continue;
      const set = configured.get(p.brandId) ?? new Set();
      for (const pl of p.platforms ?? []) {
        if (pl !== SHOPPING_PLATFORM) set.add(pl);
      }
      for (const m of p.models ?? []) set.add(modelPlatform(m));
      configured.set(p.brandId, set);
    }
    const silentByPlatform = new Map();
    for (const [brandId, entry] of rowsByBrand) {
      if (entry.total < ENGINE_MIN_ROWS) continue;
      for (const pl of configured.get(brandId) ?? []) {
        if (!entry.platforms.has(pl)) {
          const list = silentByPlatform.get(pl) ?? [];
          list.push(brandName.get(brandId) ?? brandId);
          silentByPlatform.set(pl, list);
        }
      }
    }
    if (silentByPlatform.size > 0) {
      const detail = [...silentByPlatform.entries()]
        .map(([pl, names]) => `${pl} (${names.slice(0, 3).join(', ')})`)
        .join(' · ');
      alerts.push({
        key: 'consistency-engine-silent',
        severity: 'critical',
        message: `Motor configurado sem entregar resultado na janela de ${WINDOW_DAYS} dias enquanto os demais entregaram: ${detail}. Verificar credencial/fila do motor (casos Claude e Grok).`,
      });
    }
  }

  // ── Família "contas que fecham / denominadores sãos" ─────────────────────

  // Linhas fisicamente impossíveis: contagem negativa, rank de aparição sem
  // menção (rank ≥1 exige mention_count > 0; 0 = não computável) ou sentimento
  // fora do vocabulário — qualquer uma distorce os agregados das telas.
  {
    let negative = 0;
    let rankNoMention = 0;
    let badSentiment = 0;
    for (const r of snap.recentResults) {
      if (r.mentionCount < 0 || r.citationCount < 0) negative += 1;
      if ((r.appearanceRank ?? 0) >= 1 && r.mentionCount === 0) rankNoMention += 1;
      if (r.sentiment && !VALID_SENTIMENTS.has(r.sentiment)) badSentiment += 1;
    }
    const parts = [];
    if (negative > 0) parts.push(`${negative} com contagem negativa`);
    if (rankNoMention > 0) parts.push(`${rankNoMention} com posição de aparição sem menção`);
    if (badSentiment > 0) parts.push(`${badSentiment} com sentimento fora do vocabulário`);
    if (parts.length > 0) {
      alerts.push({
        key: 'consistency-impossible-rows',
        severity: 'critical',
        message: `Linhas impossíveis em prompt_results (janela ${WINDOW_DAYS}d): ${parts.join(' · ')} — investigar o pipeline de ingestão antes que os agregados distorçam.`,
      });
    }
  }

  // Resultado com plataforma que nenhum prompt configura: a linha entra no
  // total mas some das quebras por motor — as barrinhas param de fechar com
  // o todo (a família do bug ">100%" visto de outro ângulo).
  {
    const known = new Set([SHOPPING_PLATFORM]);
    for (const p of snap.prompts) {
      for (const pl of p.platforms ?? []) known.add(pl);
      for (const m of p.models ?? []) known.add(modelPlatform(m));
    }
    const unknown = new Map();
    for (const r of snap.recentResults) {
      const pl = r.platform ?? '(null)';
      if (!known.has(r.platform)) unknown.set(pl, (unknown.get(pl) ?? 0) + 1);
    }
    if (known.size > 0 && unknown.size > 0) {
      const detail = [...unknown.entries()]
        .slice(0, 5)
        .map(([pl, n]) => `${pl}: ${n} linha(s)`)
        .join(' · ');
      alerts.push({
        key: 'consistency-unknown-platform',
        severity: 'warning',
        message: `Resultados com plataforma que nenhum prompt configura (entram no total, somem das quebras por motor): ${detail}.`,
      });
    }
  }

  // O enriquecimento de posição roda a cada 30min; backlog parado indica
  // sweep travado e o card de Ranking fica defasado do resto da tela.
  if (snap.stalledRankRows > 0) {
    alerts.push({
      key: 'consistency-rank-backlog',
      severity: 'warning',
      message: `${snap.stalledRankRows} resultado(s) com menção aguardando posição de aparição há mais de ${RANK_STALL_HOURS}h — sweep de appearance_rank possivelmente travado.`,
    });
  }

  // ── Família "recontagem independente" ────────────────────────────────────

  // Reconta menções pelo parser ATUAL (nome+domínios+aliases de hoje) e compara
  // com o valor gravado na ingestão. Divergência sistemática = alias adicionado
  // depois sem backfill — telas calculadas em momentos diferentes param de bater.
  if (
    snap.recountSample.total > 0 &&
    snap.recountSample.divergent >= RECOUNT_MIN_ROWS &&
    snap.recountSample.divergent / snap.recountSample.total >= RECOUNT_MIN_SHARE
  ) {
    alerts.push({
      key: 'consistency-mention-recount',
      severity: 'warning',
      message:
        `${snap.recountSample.divergent} de ${snap.recountSample.total} resultado(s) recentes têm mention_count divergente do parser atual ` +
        `(alias/domínio mudou depois da ingestão?) — rodar o backfill de menções (backfill-mentions).`,
    });
  }

  return alerts;
}

/** Query everything the checks need. Failures degrade to empty (never throw). */
export async function collectConsistencySnapshot() {
  // Lazy import: config/supabase.js exits the process when env is missing,
  // which would break unit tests that only need the pure evaluateConsistency.
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const now = Date.now();
  const windowIso = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
  const stallIso = new Date(now - RANK_STALL_HOURS * 3_600_000).toISOString();

  const snap = {
    brands: [],
    competitors: [],
    brandDomains: [],
    indexWeights: [],
    prompts: [],
    recentResults: [],
    stalledRankRows: 0,
    recountSample: { total: 0, divergent: 0 },
  };

  try {
    const { data } = await supabaseAdmin
      .from('brands')
      .select('id, organization_id, name, aliases, is_active');
    snap.brands = (data ?? []).map((b) => ({
      id: b.id,
      organizationId: b.organization_id,
      name: b.name,
      aliases: b.aliases ?? [],
      isActive: b.is_active !== false,
    }));
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin.from('competitors').select('brand_id, name, domain');
    snap.competitors = (data ?? []).map((c) => ({
      brandId: c.brand_id,
      name: c.name,
      domain: c.domain ?? '',
    }));
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin.from('brand_domains').select('brand_id, domain');
    snap.brandDomains = (data ?? []).map((d) => ({ brandId: d.brand_id, domain: d.domain }));
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin.from('index_weights').select('dim_key, weight');
    snap.indexWeights = (data ?? []).map((w) => ({ dimKey: w.dim_key, weight: w.weight }));
  } catch {
    /* best-effort */
  }

  try {
    // prompts → prompt_sets dá o brand_id de cada prompt (dois selects pequenos).
    const [{ data: sets }, { data: prompts }] = await Promise.all([
      supabaseAdmin.from('prompt_sets').select('id, brand_id'),
      supabaseAdmin
        .from('prompts')
        .select('prompt_set_id, platforms, models, text, is_brand_prompt')
        .eq('is_active', true)
        .limit(2000),
    ]);
    const brandBySet = new Map((sets ?? []).map((s) => [s.id, s.brand_id]));
    snap.prompts = (prompts ?? []).map((p) => ({
      brandId: brandBySet.get(p.prompt_set_id) ?? null,
      platforms: p.platforms ?? [],
      models: p.models ?? [],
      text: p.text ?? '',
      isBrandPrompt: p.is_brand_prompt === true,
    }));
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin
      .from('prompt_results')
      .select('brand_id, platform, mention_count, citation_count, appearance_rank, sentiment')
      .gte('created_at', windowIso)
      .limit(5000);
    snap.recentResults = (data ?? []).map((r) => ({
      brandId: r.brand_id,
      platform: r.platform,
      mentionCount: r.mention_count ?? 0,
      citationCount: r.citation_count ?? 0,
      appearanceRank: r.appearance_rank,
      sentiment: r.sentiment,
    }));
  } catch {
    /* best-effort */
  }

  try {
    const { count } = await supabaseAdmin
      .from('prompt_results')
      .select('*', { count: 'exact', head: true })
      .is('appearance_rank', null)
      .gt('mention_count', 0)
      .lt('created_at', stallIso);
    snap.stalledRankRows = count ?? 0;
  } catch {
    /* best-effort */
  }

  try {
    // Amostra pequena com o texto da resposta (única query pesada — limitada).
    // Exclui chatgpt-shopping: o parser de shopping tem semântica própria de
    // mention_count — recontar com countBrandMentions divergiria de propósito
    // (mesma exclusão que a action do web aplica; auditor 19/ago).
    const { data } = await supabaseAdmin
      .from('prompt_results')
      .select('brand_id, mention_count, response')
      .neq('platform', 'chatgpt-shopping')
      .order('created_at', { ascending: false })
      .limit(100);
    const domainsByBrand = new Map();
    for (const d of snap.brandDomains) {
      const list = domainsByBrand.get(d.brandId) ?? [];
      list.push(d.domain);
      domainsByBrand.set(d.brandId, list);
    }
    const brandById = new Map(snap.brands.map((b) => [b.id, b]));
    let total = 0;
    let divergent = 0;
    for (const r of data ?? []) {
      const brand = brandById.get(r.brand_id);
      if (!brand || !r.response) continue;
      total += 1;
      const recount = countBrandMentions(r.response, {
        brandName: brand.name,
        domains: domainsByBrand.get(brand.id) ?? [],
        aliases: brand.aliases,
      });
      if (recount !== (r.mention_count ?? 0)) divergent += 1;
    }
    snap.recountSample = { total, divergent };
  } catch {
    /* best-effort */
  }

  return snap;
}

/**
 * Read-only entry point: collects the snapshot and evaluates all invariants.
 * Alerts share the watchdog's shape and flow through its delivery/anti-spam.
 */
export async function checkConsistencyNow() {
  try {
    const snap = await collectConsistencySnapshot();
    return evaluateConsistency(snap, new Date());
  } catch (err) {
    logger.error({ err }, 'consistency sweep failed');
    return [];
  }
}
