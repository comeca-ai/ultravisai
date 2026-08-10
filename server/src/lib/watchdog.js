/**
 * Ultravis addition (fork layer — additive module, does not touch core logic).
 *
 * Active monitoring watchdog. The upstream ships no alerting at all: failures
 * only surface if an operator happens to look at logs or /ops. This module
 * checks the platform's own data on an interval and PUSHES an alert to
 * ALERT_WEBHOOK_URL (any JSON-accepting endpoint — n8n, Slack incoming
 * webhook, Zapier) when something is degraded, so silent failures (e.g. an
 * invalid OpenAI key making every sentiment fall back to "neutral") get
 * noticed in minutes instead of days.
 *
 * Config (all optional):
 *   ALERT_WEBHOOK_URL     — where alerts are POSTed; unset = log-only.
 *   WATCHDOG_INTERVAL_MIN — check cadence in minutes (default 15, min 5).
 *
 * Checks are pure functions over a data snapshot (see evaluateChecks) so they
 * can be unit-tested without a database.
 */

import cron from 'node-cron';
import logger from './logger.js';

/** Re-alert for a still-firing condition only after this long (anti-spam). */
const REALERT_MS = 6 * 60 * 60 * 1000;
/** A Cloro task older than this and still pending counts as stuck. */
const STUCK_TASK_HOURS = 2;
/** Sentiment check needs at least this many recent results to be meaningful. */
const SENTIMENT_MIN_SAMPLE = 20;
/** Weekly cron cadence + 1 day of slack. */
const SILENCE_DAYS = 8;

/**
 * Pure evaluation of the health snapshot. Returns a list of alerts:
 * `{ key, severity: 'critical'|'warning', message }`.
 *
 * @param {{
 *   failedJobs: { type: string, failedReason: string|null }[],
 *   stuckTasks: number,
 *   recentResults: { total: number, neutral: number },
 *   lastResultAt: string|null,
 * }} snap
 * @param {Date} now
 */
export function evaluateChecks(snap, now) {
  const alerts = [];

  if (snap.failedJobs.length > 0) {
    const reasons = [
      ...new Set(snap.failedJobs.map((j) => j.failedReason || 'sem motivo registrado')),
    ];
    alerts.push({
      key: 'jobs-failed',
      severity: 'critical',
      message: `${snap.failedJobs.length} job(s) falharam na última janela: ${reasons.join(' · ').slice(0, 300)}`,
    });
  }

  if (snap.stuckTasks > 0) {
    alerts.push({
      key: 'cloro-stuck',
      severity: 'warning',
      message: `${snap.stuckTasks} tarefa(s) Cloro pendentes há mais de ${STUCK_TASK_HOURS}h — fila possivelmente travada ou créditos esgotados.`,
    });
  }

  // 100% neutral over a real sample means the sentiment analyzer is likely
  // failing and falling back (e.g. invalid/expired OPENAI_API_KEY) — real
  // traffic always has some non-neutral share.
  if (
    snap.recentResults.total >= SENTIMENT_MIN_SAMPLE &&
    snap.recentResults.neutral === snap.recentResults.total
  ) {
    alerts.push({
      key: 'sentiment-degraded',
      severity: 'critical',
      message: `Sentimento 100% "neutral" nos últimos ${snap.recentResults.total} resultados — análise provavelmente caindo em fallback (verifique OPENAI_API_KEY no Railway).`,
    });
  }

  if (snap.lastResultAt) {
    const ageDays = (now.getTime() - new Date(snap.lastResultAt).getTime()) / 86_400_000;
    if (ageDays > SILENCE_DAYS) {
      alerts.push({
        key: 'tracking-silent',
        severity: 'warning',
        message: `Nenhum resultado novo há ${Math.floor(ageDays)} dias — o censo semanal pode não ter rodado.`,
      });
    }
  }

  return alerts;
}

/** Query everything the checks need. Failures degrade to empty (never throw). */
async function collectSnapshot(intervalMin) {
  // Lazy import: config/supabase.js exits the process when env is missing,
  // which would break unit tests that only need the pure evaluateChecks.
  const { default: supabaseAdmin } = await import('../config/supabase.js');
  const now = Date.now();
  // Look back 2× the interval so nothing slips between two runs; the
  // per-condition re-alert window keeps duplicates quiet.
  const windowIso = new Date(now - intervalMin * 2 * 60_000).toISOString();
  const stuckIso = new Date(now - STUCK_TASK_HOURS * 3_600_000).toISOString();
  const recentIso = new Date(now - 3 * 3_600_000).toISOString();

  const snap = {
    failedJobs: [],
    stuckTasks: 0,
    recentResults: { total: 0, neutral: 0 },
    lastResultAt: null,
  };

  try {
    const { data } = await supabaseAdmin
      .from('jobs')
      .select('type, failed_reason')
      .in('status', ['failed'])
      .gte('updated_at', windowIso);
    snap.failedJobs = (data ?? []).map((j) => ({ type: j.type, failedReason: j.failed_reason }));
  } catch {
    /* best-effort */
  }

  try {
    const { count } = await supabaseAdmin
      .from('cloro_pending_tasks')
      .select('*', { count: 'exact', head: true })
      .lt('submitted_at', stuckIso);
    snap.stuckTasks = count ?? 0;
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin
      .from('prompt_results')
      .select('sentiment, created_at')
      .gte('created_at', recentIso)
      .limit(1000);
    const rows = data ?? [];
    snap.recentResults.total = rows.length;
    snap.recentResults.neutral = rows.filter((r) => r.sentiment === 'neutral').length;
  } catch {
    /* best-effort */
  }

  try {
    const { data } = await supabaseAdmin
      .from('prompt_results')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    snap.lastResultAt = data?.[0]?.created_at ?? null;
  } catch {
    /* best-effort */
  }

  return snap;
}

/** In-memory anti-spam: condition key → last time it was alerted. */
const lastSent = new Map();

async function deliver(alerts) {
  const fresh = alerts.filter((a) => {
    const prev = lastSent.get(a.key) ?? 0;
    return Date.now() - prev > REALERT_MS;
  });
  if (fresh.length === 0) return;
  fresh.forEach((a) => lastSent.set(a.key, Date.now()));

  for (const a of fresh) logger.warn({ alert: a }, 'watchdog alert');

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ultravis-watchdog',
        ts: new Date().toISOString(),
        // `text` makes the payload drop-in for Slack incoming webhooks; the
        // structured `alerts` array serves n8n/custom flows.
        text: fresh.map((a) => `[${a.severity}] ${a.message}`).join('\n'),
        alerts: fresh,
      }),
    });
  } catch (err) {
    logger.error({ err }, 'watchdog: failed to deliver alert webhook');
  }
}

export async function runWatchdogOnce(intervalMin = 15) {
  const snap = await collectSnapshot(intervalMin);
  const alerts = evaluateChecks(snap, new Date());
  await deliver(alerts);
  return alerts;
}

/** Start the periodic check. Safe to call unconditionally at boot. */
export function startWatchdog() {
  const intervalMin = Math.max(5, parseInt(process.env.WATCHDOG_INTERVAL_MIN || '15', 10) || 15);
  cron.schedule(`*/${intervalMin} * * * *`, async () => {
    try {
      await runWatchdogOnce(intervalMin);
    } catch (err) {
      logger.error({ err }, 'watchdog run failed');
    }
  });
  logger.info({ intervalMin, webhook: Boolean(process.env.ALERT_WEBHOOK_URL) }, 'watchdog active');
}
