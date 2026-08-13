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
 * Config (all optional; email and webhook are independent — configure either
 * or both):
 *   ALERT_WEBHOOK_URL     — where alerts are POSTed; unset = skip webhook.
 *   ALERT_EMAIL_TO        — address to email alerts to (SMTP vars required).
 *   SMTP_HOST / SMTP_PORT — SMTP server (default smtp.gmail.com:465).
 *   SMTP_USER / SMTP_PASS — SMTP credentials (Gmail: use an App Password).
 *   ALERT_EMAIL_FROM      — sender address (default: SMTP_USER).
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

  // Regra do dono (11/ago): toda marca precisa de um usuário ativo por trás.
  // Uma marca ativa em org sem usuário só gasta crédito sem ninguém olhando.
  if ((snap.orphanBrands ?? 0) > 0) {
    alerts.push({
      key: 'orphan-brands',
      severity: 'warning',
      message: `${snap.orphanBrands} marca(s) ativa(s) em organização sem nenhum usuário — pausar ou apagar (o arquivo-morto preserva os dados).`,
    });
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
    orphanBrands: 0,
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

  try {
    // Active brands whose org has no user profile ("toda marca precisa de um
    // usuário ativo", 11/ago). Two small queries — org counts are tiny.
    const { data: profs } = await supabaseAdmin.from('profiles').select('organization_id');
    const orgsWithUsers = [...new Set((profs ?? []).map((p) => p.organization_id))].filter(Boolean);
    let query = supabaseAdmin
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    if (orgsWithUsers.length > 0) {
      query = query.not('organization_id', 'in', `(${orgsWithUsers.join(',')})`);
    }
    const { count } = await query;
    snap.orphanBrands = count ?? 0;
  } catch {
    /* best-effort */
  }

  return snap;
}

/**
 * Pure formatter for the alert email (exported for unit tests).
 *
 * @param {{ key: string, severity: string, message: string }[]} alerts
 * @param {Date} now
 */
export function formatAlertEmail(alerts, now) {
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const subject =
    `[Ultravis] ${alerts.length} alerta(s) do monitoramento` +
    (critical > 0 ? ` — ${critical} crítico(s)` : '');
  const lines = alerts.map((a) => `• [${a.severity.toUpperCase()}] ${a.message}`);
  const text = [
    `O watchdog da Ultravis detectou ${alerts.length} problema(s) em ${now.toISOString()}:`,
    '',
    ...lines,
    '',
    'Onde olhar: painel /ops (jobs e log) · Railway (logs do server) · Supabase.',
    'Este aviso repete no máximo a cada 6h por condição enquanto ela persistir.',
  ].join('\n');
  return { subject, text };
}

async function sendEmailAlert(fresh) {
  const to = process.env.ALERT_EMAIL_TO;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!to || !user || !pass) return;

  try {
    // Lazy import keeps boot/test paths free of the dependency.
    const { default: nodemailer } = await import('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '465', 10) || 465;
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    const { subject, text } = formatAlertEmail(fresh, new Date());
    await transport.sendMail({
      from: process.env.ALERT_EMAIL_FROM || user,
      to,
      subject,
      text,
    });
  } catch (err) {
    logger.error({ err }, 'watchdog: failed to deliver alert email');
  }
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

  await sendEmailAlert(fresh);

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

/**
 * Read-only health check for the /ops panel: evaluates the exact same checks
 * the cron uses, but never delivers alerts nor touches the anti-spam state.
 */
export async function checkHealthNow(intervalMin = 15) {
  const snap = await collectSnapshot(intervalMin);
  return evaluateChecks(snap, new Date());
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
  logger.info(
    {
      intervalMin,
      webhook: Boolean(process.env.ALERT_WEBHOOK_URL),
      email: Boolean(process.env.ALERT_EMAIL_TO && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
    'watchdog active',
  );
}
