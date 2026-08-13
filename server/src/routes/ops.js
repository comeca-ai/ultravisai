/**
 * Ultravis addition (fork layer — additive route, does not touch core logic).
 *
 * Operator dashboard at GET /ops — a standalone health & consumption panel
 * served by the Railway server itself, with its OWN login (HTTP Basic Auth),
 * separate from the product's Supabase/Google auth. Answers "how is the
 * machine, and what is it consuming?" without opening four provider consoles.
 *
 * Auth: set OPS_USER and OPS_PASS in the Railway env. If either is missing the
 * route returns 503 (fails closed — never exposes data unauthenticated).
 * Machine metrics come from the running process; consumption counts come from
 * the DB via the admin client. Provider keys are reported as present/absent
 * booleans only — never the value.
 */

import { Router } from 'express';
import crypto from 'crypto';
import supabaseAdmin from '../config/supabase.js';

const router = Router();

function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// HTTP Basic Auth — its own credentials, independent from the app login.
function basicAuth(req, res, next) {
  const user = process.env.OPS_USER;
  const pass = process.env.OPS_PASS;
  if (!user || !pass) {
    return res.status(503).send('Ops panel not configured (set OPS_USER and OPS_PASS).');
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const [u, p] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (u && p && safeEqual(u, user) && safeEqual(p, pass)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Ultravis Ops", charset="UTF-8"');
  return res.status(401).send('Auth required');
}

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

async function collect() {
  const mem = process.memoryUsage();
  const machine = {
    uptime: fmtUptime(process.uptime()),
    rss: mb(mem.rss),
    heapUsed: mb(mem.heapUsed),
    heapTotal: mb(mem.heapTotal),
    node: process.version,
    mode: process.env.IS_CLOUD === 'true' ? 'cloud' : 'self-hosted',
    region: process.env.RAILWAY_REPLICA_REGION || process.env.RAILWAY_ENVIRONMENT_NAME || '—',
  };

  const providers = {
    Anthropic: !!process.env.ANTHROPIC_API_KEY,
    OpenAI: !!process.env.OPENAI_API_KEY,
    Gemini: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    Cloro: !!process.env.CLORO_API_KEY,
    'Cloro webhook': !!process.env.CLORO_WEBHOOK_URL,
  };

  // Consumption counts (best-effort; a failing count shows as null, not a 500).
  const count = async (table, mod) => {
    try {
      let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
      if (mod) q = mod(q);
      const { count: c } = await q;
      return c ?? 0;
    } catch {
      return null;
    }
  };
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [results, results24h, pending, brands, activePrompts, audits] = await Promise.all([
    count('prompt_results'),
    count('prompt_results', (q) => q.gte('created_at', since24h)),
    count('cloro_pending_tasks'),
    count('brands'),
    count('prompts', (q) => q.eq('is_active', true)),
    count('site_audits'),
  ]);

  // Accounts — who signed up, when, last sign-in and via which provider.
  // Uses the auth admin API (service role). Newest first; capped at 25.
  let accounts = [];
  let rawUsers = [];
  try {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    rawUsers = list?.users ?? [];
    accounts = rawUsers
      .map((u) => ({
        email: u.email || '—',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        providers: (
          u.app_metadata?.providers || (u.app_metadata?.provider ? [u.app_metadata.provider] : [])
        ).join(', '),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 25);
  } catch {
    accounts = null;
  }

  // Live health: the watchdog's own checks, evaluated on demand (read-only —
  // no alert delivery, no anti-spam state). Lazy import keeps boot order sane.
  let health = null;
  try {
    const { checkHealthNow } = await import('../lib/watchdog.js');
    health = await checkHealthNow();
  } catch {
    health = null;
  }

  // Clients × brands — the whole customer base at a glance.
  let clients = null;
  try {
    const [{ data: orgs }, { data: profs }, { data: brandRows }] = await Promise.all([
      supabaseAdmin.from('organizations').select('id, name'),
      supabaseAdmin.from('profiles').select('id, organization_id'),
      supabaseAdmin.from('brands').select('id, name, is_active, organization_id, created_at'),
    ]);
    const emailById = Object.fromEntries(rawUsers.map((u) => [u.id, u.email || '—']));
    clients = (orgs ?? [])
      .map((o) => ({
        org: o.name,
        users: (profs ?? [])
          .filter((p) => p.organization_id === o.id)
          .map((p) => emailById[p.id] || '—'),
        brands: (brandRows ?? [])
          .filter((b) => b.organization_id === o.id)
          .sort((a, b) => Number(b.is_active) - Number(a.is_active))
          .map((b) => ({ name: b.name, active: b.is_active })),
      }))
      .sort((a, b) => a.org.localeCompare(b.org));
  } catch {
    clients = null;
  }

  // Recent runs (the platform's own job log) — tracking/content jobs with
  // status and failure reason. `jobs` is a server-only table (RLS on, no
  // policy), so only this service-role client can read it; that's why the
  // in-app pages can't show it and this panel can. Newest first, capped at 15.
  let jobs = [];
  try {
    const { data: jobRows } = await supabaseAdmin
      .from('jobs')
      .select('type, status, brand_id, failed_reason, attempts, created_at')
      .order('created_at', { ascending: false })
      .limit(15);
    const ids = [...new Set((jobRows ?? []).map((j) => j.brand_id).filter(Boolean))];
    let names = {};
    if (ids.length) {
      const { data: bs } = await supabaseAdmin.from('brands').select('id, name').in('id', ids);
      names = Object.fromEntries((bs ?? []).map((b) => [b.id, b.name]));
    }
    jobs = (jobRows ?? []).map((j) => ({
      type: j.type,
      status: j.status,
      brand: names[j.brand_id] || '—',
      failedReason: j.failed_reason || null,
      attempts: j.attempts || 0,
      createdAt: j.created_at,
    }));
  } catch {
    jobs = null;
  }
  const jobsFailed24h = await count('jobs', (q) =>
    q.in('status', ['failed', 'cancelled']).gte('created_at', since24h),
  );

  return {
    machine,
    providers,
    consumption: { results, results24h, pending, brands, activePrompts, audits },
    accounts,
    jobs,
    jobsFailed24h,
    health,
    clients,
    now: new Date().toISOString(),
  };
}

function render(d) {
  const row = (label, value) =>
    `<div class="row"><span class="l">${label}</span><span class="v">${value ?? '—'}</span></div>`;
  const chip = (label, on) =>
    `<span class="chip ${on ? 'on' : 'off'}">${on ? '●' : '○'} ${label}</span>`;
  const dt = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '—');
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );
  const JOB_LABEL = { tracking: 'Rastreamento', content: 'Conteúdo' };
  const ST_LABEL = {
    waiting: 'Na fila',
    active: 'Rodando',
    completed: 'Concluído',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  };
  const ST_CLASS = {
    completed: 'st-ok',
    active: 'st-run',
    waiting: 'st-mut',
    failed: 'st-bad',
    cancelled: 'st-warn',
  };
  const jobsRows =
    d.jobs === null
      ? '<tr><td colspan="5" class="muted">não foi possível carregar</td></tr>'
      : d.jobs.length === 0
        ? '<tr><td colspan="5" class="muted">nenhuma execução ainda</td></tr>'
        : d.jobs
            .map((j) => {
              const detail = j.failedReason
                ? `<span class="bad">${esc(j.failedReason.slice(0, 70))}</span>`
                : j.attempts > 1
                  ? `${j.attempts} tentativas`
                  : '—';
              return `<tr><td class="mono">${dt(j.createdAt)}</td><td>${JOB_LABEL[j.type] || esc(j.type)}</td><td>${esc(j.brand)}</td><td><span class="st ${ST_CLASS[j.status] || 'st-mut'}">${ST_LABEL[j.status] || esc(j.status)}</span></td><td class="muted">${detail}</td></tr>`;
            })
            .join('');
  const accountsRows =
    d.accounts === null
      ? '<tr><td colspan="4" class="muted">não foi possível carregar</td></tr>'
      : d.accounts.length === 0
        ? '<tr><td colspan="4" class="muted">nenhuma conta ainda</td></tr>'
        : d.accounts
            .map(
              (a) =>
                `<tr><td>${a.email}</td><td class="mono">${dt(a.createdAt)}</td><td class="mono">${dt(a.lastSignInAt)}</td><td class="muted">${a.providers || '—'}</td></tr>`,
            )
            .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Ultravis · Ops</title>
<style>
  :root{--bg:#16130f;--card:#1e1a15;--ink:#f1ebe1;--ink2:#b7ac9d;--ink3:#867c6e;--line:#332c22;--red:#ef6a52;--ok:#4cc08a;--off:#6b6157}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:26px 18px 60px}
  .wrap{max-width:760px;margin:0 auto}
  h1{font-size:20px;letter-spacing:-.01em;display:flex;align-items:center;gap:9px}
  h1 .dot{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 8px var(--ok)}
  .sub{color:var(--ink3);font-size:12px;margin:3px 0 20px;font-family:ui-monospace,monospace}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:620px){.grid{grid-template-columns:1fr}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 17px}
  .card h2{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3);margin-bottom:11px}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px}
  .row:last-child{border-bottom:none}
  .row .l{color:var(--ink2)} .row .v{font-family:ui-monospace,monospace;font-weight:600}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
  .kpi .n{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
  .kpi .t{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-top:2px}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font-size:11px;font-family:ui-monospace,monospace;padding:3px 9px;border-radius:99px;border:1px solid var(--line)}
  .chip.on{color:var(--ok)} .chip.off{color:var(--off)}
  table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:4px}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);font-weight:600;padding:5px 8px 5px 0;border-bottom:1px solid var(--line)}
  td{padding:6px 8px 6px 0;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:none}
  td.mono{font-family:ui-monospace,monospace;color:var(--ink2);white-space:nowrap}
  td.muted,.muted{color:var(--ink3)}
  .st{font-size:10.5px;font-family:ui-monospace,monospace;padding:2px 7px;border-radius:99px;border:1px solid var(--line);white-space:nowrap}
  .st-ok{color:var(--ok)} .st-bad{color:var(--red)} .st-warn{color:#e0a458} .st-run{color:#5aa9e6} .st-mut{color:var(--ink3)}
  .bad{color:var(--red)}
  .ovf{overflow-x:auto}
  .foot{color:var(--ink3);font-size:11px;margin-top:22px;font-family:ui-monospace,monospace}
</style></head><body><div class="wrap">
  <h1><span class="dot"></span>Ultravis · Ops</h1>
  <div class="sub">servidor Railway · atualiza a cada 30s · ${d.machine.mode} · ${d.machine.region}</div>

  <div class="kpis">
    <div class="kpi"><div class="n">${d.consumption.results24h ?? '—'}</div><div class="t">Respostas 24h</div></div>
    <div class="kpi"><div class="n">${d.consumption.pending ?? '—'}</div><div class="t">Cloro na fila</div></div>
    <div class="kpi"><div class="n">${d.machine.uptime}</div><div class="t">Uptime</div></div>
  </div>

  <div class="card" style="margin-bottom:14px"><h2>Saúde (watchdog · mesmos checks do alerta)</h2>
    ${
      d.health === null
        ? '<div class="muted">não foi possível avaliar</div>'
        : d.health.length === 0
          ? '<div style="color:var(--ok)">● Nenhum alerta ativo — tudo saudável</div>'
          : d.health
              .map(
                (a) =>
                  `<div class="row"><span class="l"><span class="st ${a.severity === 'critical' ? 'st-bad' : 'st-warn'}">${a.severity === 'critical' ? 'CRÍTICO' : 'ATENÇÃO'}</span></span><span style="font-size:13px">${esc(a.message)}</span></div>`,
              )
              .join('')
    }
  </div>

  <div class="grid">
    <div class="card"><h2>Máquina</h2>
      ${row('Uptime', d.machine.uptime)}
      ${row('Memória (RSS)', d.machine.rss)}
      ${row('Heap usado', `${d.machine.heapUsed} / ${d.machine.heapTotal}`)}
      ${row('Node', d.machine.node)}
      ${row('Modo', d.machine.mode)}
    </div>
    <div class="card"><h2>Consumo (banco)</h2>
      ${row('Respostas (total)', d.consumption.results)}
      ${row('Respostas (24h)', d.consumption.results24h)}
      ${row('Cloro pendentes', d.consumption.pending)}
      ${row('Marcas', d.consumption.brands)}
      ${row('Prompts ativos', d.consumption.activePrompts)}
      ${row('Site audits', d.consumption.audits)}
    </div>
  </div>

  <div class="card" style="margin-top:14px"><h2>Execuções recentes${d.jobsFailed24h ? ` · <span class="bad">${d.jobsFailed24h} falha(s) em 24h</span>` : ''}</h2>
    <div class="ovf"><table>
      <thead><tr><th>Quando (UTC)</th><th>Tipo</th><th>Marca</th><th>Status</th><th>Detalhe</th></tr></thead>
      <tbody>${jobsRows}</tbody>
    </table></div>
  </div>

  <div class="card" style="margin-top:14px"><h2>Clientes × Marcas</h2>
    <div class="ovf"><table>
      <thead><tr><th>Organização</th><th>Usuários</th><th>Marcas</th></tr></thead>
      <tbody>${
        d.clients === null
          ? '<tr><td colspan="3" class="muted">não foi possível carregar</td></tr>'
          : d.clients.length === 0
            ? '<tr><td colspan="3" class="muted">nenhuma organização ainda</td></tr>'
            : d.clients
                .map(
                  (c) =>
                    `<tr><td>${esc(c.org)}</td><td class="mono">${c.users.map(esc).join('<br>') || '<span class="muted">sem usuário ⚠️</span>'}</td><td>${c.brands.map((b) => `<span class="st ${b.active ? 'st-ok' : 'st-mut'}">${esc(b.name)}${b.active ? '' : ' · pausada'}</span>`).join(' ') || '<span class="muted">—</span>'}</td></tr>`,
                )
                .join('')
      }</tbody>
    </table></div>
  </div>

  <div class="card" style="margin-top:14px"><h2>Contas${d.accounts && d.accounts.length ? ` (${d.accounts.length})` : ''}</h2>
    <div class="ovf"><table>
      <thead><tr><th>E-mail</th><th>Criada em (UTC)</th><th>Último acesso</th><th>Login</th></tr></thead>
      <tbody>${accountsRows}</tbody>
    </table></div>
  </div>

  <div class="card" style="margin-top:14px"><h2>Providers configurados</h2>
    <div class="chips">${Object.entries(d.providers)
      .map(([k, v]) => chip(k, v))
      .join('')}</div>
  </div>

  <div class="foot">
    ${d.now}<br>
    Custo real de tokens vive nos consoles (console.anthropic.com · platform.openai.com · Cloro).
    Métricas de CPU/rede: painel do Railway.
  </div>
</div></body></html>`;
}

router.get('/ops', basicAuth, async (req, res) => {
  try {
    const data = await collect();
    res.set('Cache-Control', 'no-store');
    res.type('html').send(render(data));
  } catch {
    res.status(500).send('ops error');
  }
});

// JSON variant for scripting / uptime checks (same auth).
router.get('/ops.json', basicAuth, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await collect());
  } catch {
    res.status(500).json({ error: 'ops error' });
  }
});

export default router;
