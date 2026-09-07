/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Vigia de consistência — CAMADA 2 (agente LLM semanal). A camada 1
 * (consistency.js) fiscaliza invariantes determinísticas a cada 15 min; esta
 * camada roda UMA vez por semana, depois do censo, e caça o que regra fixa
 * não pega: número que não fecha entre superfícies, média escondendo
 * extremos, rótulo que não bate com o que o número mede, distribuição
 * suspeita, incoerência IC × Score × Insights.
 *
 * Mecânica (custo: 1 chamada de LLM por rodada):
 *   1. Agrega do banco os números consolidados da última janela — por marca
 *      ativa e por motor: presença, menções, citações, ranking médio (com
 *      extremos), contagens de sentimento — mais os achados recentes da
 *      camada 1 (o LLM cruza os dois).
 *   2. Uma chamada de `generateObject` (modelo de CONSISTENCY_LLM_MODEL,
 *      fallback AUDIT_LLM_MODEL) devolve achados estruturados
 *      `{ severity: info|warn|critical, code, message, evidence }`.
 *   3. Os achados viram alertas no MESMO formato/caminho da camada 1: ficam
 *      em cache aqui e o watchdog os mescla no ciclo de 15 min
 *      (getLlmConsistencyAlerts) — mesmo /ops, mesma entrega, mesmo
 *      anti-spam de 6h por condição. Prefixo de chave: "llm-".
 *
 * Gating e segurança: sem CONSISTENCY_LLM_MODEL E sem AUDIT_LLM_MODEL o
 * agente não agenda nada (só loga que está desligado). Timeout e qualquer
 * erro degradam para lista vazia — NUNCA derrubam o server.
 *
 * Agenda: CONSISTENCY_LLM_CRON, default segunda 09:00 UTC — ~3h depois do
 * censo semanal (DAILY_CRON_SCHEDULE '0 6 * * 1'), tempo da fila drenar.
 */

import cron from 'node-cron';
import { generateObject } from 'ai';
import { z } from 'zod';
import logger from './logger.js';
import { resolveModel } from './ai-provider.js';
import { withRetry } from './retry.js';

/** Segunda 09:00 UTC — ~3h após o censo de segunda 06:00 UTC. */
export const CONSISTENCY_LLM_DEFAULT_CRON = '0 9 * * 1';
/** Mesma janela da camada 1: cadência semanal do censo + 1 dia de folga. */
const WINDOW_DAYS = 8;
/** Uma chamada por semana pode esperar; acima disso é problema do provedor. */
const LLM_TIMEOUT_MS = 90_000;
/**
 * Teto de achados aproveitados por rodada — aplicado EM CÓDIGO (slice):
 * Anthropic structured outputs rejeitam minItems/maxItems/minimum em schemas
 * de generateObject (padrão do PR #9 — contagens validam dentro do withRetry).
 */
const MAX_FINDINGS = 10;
/**
 * Os achados ficam mesclados no ciclo do watchdog até a próxima rodada
 * semanal substituí-los (7 dias + folga). O anti-spam de 6h do watchdog é
 * quem controla a re-entrega — mesmo comportamento das condições
 * persistentes da camada 1 (ex.: orphan-brands).
 */
const FINDINGS_TTL_MS = (WINDOW_DAYS + 1) * 86_400_000;

const findingSchema = z.object({
  severity: z.enum(['info', 'warn', 'critical']),
  code: z.string(),
  message: z.string(),
  evidence: z.string(),
});
// Sem minItems/maxItems de propósito (ver MAX_FINDINGS acima).
const responseSchema = z.object({ findings: z.array(findingSchema) });

/** Modelo da rodada: env própria com fallback pro modelo do Site Audit. */
export function resolveConsistencyLlmModel(env = process.env) {
  return env.CONSISTENCY_LLM_MODEL || env.AUDIT_LLM_MODEL || null;
}

/** Média com 2 casas, null para amostra vazia. */
function avg(nums) {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100;
}

/** Percentual com 1 casa. */
function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/**
 * Agregação pura dos resultados da janela — por marca ativa e por motor:
 * presença (share de respostas com menção), menções, citações, ranking de
 * aparição (média + extremos, para o LLM ver média escondendo extremo) e
 * contagens de sentimento. Unit-testável sem banco.
 *
 * @param {{ id: string, name: string, isActive: boolean }[]} brands
 * @param {{ brandId: string, platform: string|null, mentionCount: number,
 *   citationCount: number, appearanceRank: number|null, sentiment: string|null }[]} results
 */
export function summarizeBrandMetrics(brands, results) {
  const byBrand = new Map();
  for (const r of results) {
    const list = byBrand.get(r.brandId) ?? [];
    list.push(r);
    byBrand.set(r.brandId, list);
  }

  const summary = [];
  for (const b of brands) {
    if (!b.isActive) continue;
    const rows = byBrand.get(b.id) ?? [];
    if (rows.length === 0) continue;

    const byEngine = new Map();
    for (const r of rows) {
      const key = r.platform ?? '(null)';
      const list = byEngine.get(key) ?? [];
      list.push(r);
      byEngine.set(key, list);
    }

    const engines = [...byEngine.entries()]
      .sort(([a], [b2]) => a.localeCompare(b2))
      .map(([platform, list]) => {
        const withMention = list.filter((r) => (r.mentionCount ?? 0) > 0);
        const ranks = list
          .map((r) => r.appearanceRank)
          .filter((v) => typeof v === 'number' && v >= 1);
        const sentiment = { positive: 0, neutral: 0, negative: 0 };
        for (const r of withMention) {
          if (r.sentiment in sentiment) sentiment[r.sentiment] += 1;
        }
        return {
          platform,
          results: list.length,
          withMention: withMention.length,
          presencePct: pct(withMention.length, list.length),
          mentions: list.reduce((s, r) => s + (r.mentionCount ?? 0), 0),
          citations: list.reduce((s, r) => s + (r.citationCount ?? 0), 0),
          avgRank: avg(ranks),
          minRank: ranks.length ? Math.min(...ranks) : null,
          maxRank: ranks.length ? Math.max(...ranks) : null,
          sentiment,
        };
      });

    const withMention = rows.filter((r) => (r.mentionCount ?? 0) > 0);
    summary.push({
      brand: b.name,
      totalResults: rows.length,
      presencePct: pct(withMention.length, rows.length),
      mentions: rows.reduce((s, r) => s + (r.mentionCount ?? 0), 0),
      citations: rows.reduce((s, r) => s + (r.citationCount ?? 0), 0),
      engines,
    });
  }
  return summary;
}

/** Slug estável para a chave do alerta ("Média -- Extremo!" → "media-extremo"). */
function slugifyCode(code) {
  return String(code ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Achados do LLM → alertas no formato do watchdog (`{ key, severity,
 * message }`), prefixo "llm-". Puro, unit-testável:
 *  - severity: critical→critical, warn→warning; "info" NÃO vira alerta
 *    (fica só no log da rodada — o canal de alerta é para ação);
 *  - chaves duplicadas ganham sufixo numérico (o anti-spam do watchdog
 *    deduplica por chave — dois achados distintos não podem colidir);
 *  - evidência entra no corpo da mensagem, truncada.
 *
 * @param {{ severity: string, code: string, message: string, evidence?: string }[]} findings
 */
export function findingsToAlerts(findings) {
  const alerts = [];
  const seen = new Map();
  for (const f of findings ?? []) {
    if (f.severity !== 'critical' && f.severity !== 'warn') continue;
    const base = `llm-${slugifyCode(f.code) || 'achado'}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const evidence = String(f.evidence ?? '').trim();
    const message =
      String(f.message ?? '').trim().slice(0, 400) +
      (evidence ? ` — evidência: ${evidence.slice(0, 300)}` : '');
    alerts.push({
      key: n === 1 ? base : `${base}-${n}`,
      severity: f.severity === 'critical' ? 'critical' : 'warning',
      message,
    });
  }
  return alerts;
}

const SYSTEM_PROMPT = `You are a data-consistency auditor for an AI brand-visibility platform (it measures how often AI engines mention/cite brands). You receive the consolidated post-census numbers per active brand and per engine, plus the recent findings of the deterministic rule layer.

Your ONLY job is to hunt INCOHERENCE in the numbers — things fixed rules miss:
- numbers that do not close across surfaces (per-engine breakdown vs totals, mentions vs presence, citations without mentions at scale);
- an average hiding extremes (e.g. avgRank looks fine but min/max reveal a bimodal or degenerate distribution, or one engine drags the mean);
- a label/metric mismatch (a metric whose value cannot mean what its name implies given the other numbers);
- suspicious distributions (100% of anything over a real sample, all-identical values, one engine with wildly different volume than its peers for the same brand);
- incoherence between the deterministic layer's findings and the aggregates.

You are NOT a product consultant: no opinions on strategy, UX or feature ideas. Only report what the numbers themselves make suspicious, and only when the sample is big enough to matter (ignore brands/engines with a handful of rows). Few high-quality findings beat many weak ones; return an empty list when the numbers are coherent.

For each finding return:
- severity: "critical" (an aggregate on screen is likely wrong), "warn" (suspicious, needs a human look) or "info" (worth noting, no action);
- code: short stable kebab-case slug for the finding TYPE (e.g. "avg-hides-extremes", "engine-volume-outlier") — the same type next week must produce the same code;
- message: ONE actionable sentence in Brazilian Portuguese (pt-BR), naming brand/engine and the numbers involved;
- evidence: the specific numbers that support it, in pt-BR, compact.`;

/** Monta o prompt da rodada (JSON compacto — o modelo lê melhor que prosa). */
export function buildPrompt(summary, layer1Alerts, windowDays = WINDOW_DAYS) {
  return [
    `Census window: last ${windowDays} days. Consolidated numbers per active brand and per engine (presencePct = % of answers mentioning the brand; avgRank/minRank/maxRank = appearance rank, 1 = first mentioned; sentiment counted only on answers WITH mention):`,
    JSON.stringify(summary),
    '',
    'Findings of the deterministic rule layer in the same window (already alerted — do NOT repeat them; use them only to cross-check the aggregates):',
    JSON.stringify((layer1Alerts ?? []).map((a) => ({ key: a.key, message: a.message }))),
    '',
    'Return your incoherence findings (empty list if the numbers are coherent).',
  ].join('\n');
}

/** Coleta best-effort (nunca lança): marcas ativas + resultados da janela. */
async function collectLlmSnapshot() {
  // Lazy import: config/supabase.js encerra o processo sem env — quebraria
  // testes que só usam as funções puras (mesmo padrão de consistency.js).
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const windowIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const snap = { brands: [], results: [], layer1Alerts: [] };

  try {
    const { data } = await supabaseAdmin.from('brands').select('id, name, is_active');
    snap.brands = (data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      isActive: b.is_active !== false,
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
    snap.results = (data ?? []).map((r) => ({
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
    const { checkConsistencyNow } = await import('./consistency.js');
    snap.layer1Alerts = await checkConsistencyNow();
  } catch {
    /* best-effort */
  }

  return snap;
}

/** Cache da última rodada — o watchdog lê daqui (leitura pura, sem LLM). */
let lastRun = null; // { at: number, alerts: {key,severity,message}[] }

/**
 * Alertas da última rodada semanal, para o watchdog mesclar no ciclo de
 * 15 min (mesmo /ops, mesma entrega, mesmo anti-spam da camada 1). Vazio
 * quando nunca rodou ou quando a rodada expirou sem substituta.
 */
export function getLlmConsistencyAlerts(now = Date.now()) {
  if (!lastRun || now - lastRun.at > FINDINGS_TTL_MS) return [];
  return lastRun.alerts;
}

/** Só para testes: zera o cache da rodada. */
export function _resetLlmConsistencyCache() {
  lastRun = null;
}

/**
 * Uma rodada completa: coleta → 1 chamada de LLM → cache de alertas.
 * Erro/timeout NUNCA propagam — loga warn e devolve lista vazia.
 */
export async function runConsistencyLlmOnce() {
  const modelString = resolveConsistencyLlmModel();
  if (!modelString) {
    logger.info(
      'consistency-llm: disabled (set CONSISTENCY_LLM_MODEL or AUDIT_LLM_MODEL to enable)',
    );
    return [];
  }

  try {
    const snap = await collectLlmSnapshot();
    const summary = summarizeBrandMetrics(snap.brands, snap.results);
    if (summary.length === 0) {
      logger.info('consistency-llm: no consolidated results in window, skipping run');
      return [];
    }

    const { object } = await withRetry(
      async () => {
        const result = await generateObject({
          model: resolveModel(modelString),
          schema: responseSchema,
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(summary, snap.layer1Alerts),
          abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        });
        // Anthropic structured outputs rejeitam minItems/maxItems/minimum —
        // a validação de contagem/conteúdo vive aqui (padrão do PR #9):
        // item sem code ou sem message = resposta malformada, tenta de novo.
        if (!Array.isArray(result.object.findings)) {
          throw new Error('findings is not an array');
        }
        for (const f of result.object.findings) {
          if (!String(f.code ?? '').trim() || !String(f.message ?? '').trim()) {
            throw new Error('finding with empty code or message');
          }
        }
        return result;
      },
      { label: 'consistency-llm' },
    );

    // Teto em código (não no schema — ver MAX_FINDINGS).
    const findings = object.findings.slice(0, MAX_FINDINGS);
    for (const f of findings) {
      const log = f.severity === 'info' ? logger.info.bind(logger) : logger.warn.bind(logger);
      log({ finding: f, model: modelString }, 'consistency-llm finding');
    }

    const alerts = findingsToAlerts(findings);
    lastRun = { at: Date.now(), alerts };
    logger.info(
      { model: modelString, brands: summary.length, findings: findings.length, alerts: alerts.length },
      'consistency-llm: weekly run complete',
    );
    return alerts;
  } catch (err) {
    logger.warn({ err, model: modelString }, 'consistency-llm: weekly run failed (non-fatal)');
    return [];
  }
}

/**
 * Agenda a rodada semanal. Seguro chamar incondicionalmente no boot: sem
 * modelo configurado não agenda nada (feature desligada, só loga).
 */
export function startConsistencyLlm() {
  const modelString = resolveConsistencyLlmModel();
  if (!modelString) {
    logger.info(
      'consistency-llm: disabled — set CONSISTENCY_LLM_MODEL (or AUDIT_LLM_MODEL) to enable the weekly LLM consistency pass',
    );
    return;
  }

  let schedule = process.env.CONSISTENCY_LLM_CRON || CONSISTENCY_LLM_DEFAULT_CRON;
  if (!cron.validate(schedule)) {
    logger.warn(
      { schedule, fallback: CONSISTENCY_LLM_DEFAULT_CRON },
      'consistency-llm: invalid CONSISTENCY_LLM_CRON, using default',
    );
    schedule = CONSISTENCY_LLM_DEFAULT_CRON;
  }

  cron.schedule(schedule, () => {
    runConsistencyLlmOnce().catch((err) =>
      // runConsistencyLlmOnce já engole tudo; cinto e suspensório.
      logger.warn({ err }, 'consistency-llm: scheduled run crashed (non-fatal)'),
    );
  });
  logger.info({ schedule, model: modelString }, 'consistency-llm active (weekly)');
}
