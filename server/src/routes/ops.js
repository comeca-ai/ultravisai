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

  return {
    machine,
    providers,
    consumption: { results, results24h, pending, brands, activePrompts, audits },
    now: new Date().toISOString(),
  };
}

function render(d) {
  const row = (label, value) =>
    `<div class="row"><span class="l">${label}</span><span class="v">${value ?? '—'}</span></div>`;
  const chip = (label, on) =>
    `<span class="chip ${on ? 'on' : 'off'}">${on ? '●' : '○'} ${label}</span>`;
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
  .foot{color:var(--ink3);font-size:11px;margin-top:22px;font-family:ui-monospace,monospace}
</style></head><body><div class="wrap">
  <h1><span class="dot"></span>Ultravis · Ops</h1>
  <div class="sub">servidor Railway · atualiza a cada 30s · ${d.machine.mode} · ${d.machine.region}</div>

  <div class="kpis">
    <div class="kpi"><div class="n">${d.consumption.results24h ?? '—'}</div><div class="t">Respostas 24h</div></div>
    <div class="kpi"><div class="n">${d.consumption.pending ?? '—'}</div><div class="t">Cloro na fila</div></div>
    <div class="kpi"><div class="n">${d.machine.uptime}</div><div class="t">Uptime</div></div>
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

  <div class="card" style="margin-top:14px"><h2>Providers configurados</h2>
    <div class="chips">${Object.entries(d.providers).map(([k, v]) => chip(k, v)).join('')}</div>
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
