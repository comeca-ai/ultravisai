/**
 * Ultravis Server no Cloudflare — worker ÚNICO do produto.
 *
 * Um produto = um worker (decisão do dono, 07/set): o Express de server/ roda
 * INTACTO dentro do container (mesmo Dockerfile do Railway) e este Worker é a
 * frente dele:
 *  - fetch `/espelho*`: visualizador do espelho D1 (binding DB, somente
 *    leitura) — atendido NA EDGE, nunca chega ao container;
 *  - fetch (qualquer outro caminho): vai pro container (API, /cloro/callback,
 *    /ops, tudo) — comportamento inalterado;
 *  - scheduled (cron a cada 10 min): keepalive — mantém o container acordado
 *    para o node-cron INTERNO continuar agendando censo/vigia/reviews.
 *
 * ATENÇÃO — `/espelho` é prefixo RESERVADO da edge: o Express monta dois
 * routers na raiz (app.use('/', ...)), então uma rota `/espelho` criada lá no
 * futuro ficaria silenciosamente inalcançável. Conferido em 07/set: o Express
 * não usa nenhum caminho com esse prefixo.
 *
 * Env/segredos: setados NO WORKER (painel ou sync-cf-secrets) e injetados no
 * container NO MOMENTO DO START via startOptions.envVars — na lib 0.0.28 o
 * this.envVars de construtor não chegou ao container (provado no log de
 * 06/set 20:06 UTC: "Missing SUPABASE_URL..." em crash-loop). Duas armadilhas
 * documentadas no fonte da lib:
 *  1. startAndWaitForPorts PULA o start() se o container já está `running`
 *     (short-circuit de healthy) — e o pm2-runtime nunca morre, então um
 *     container que subiu sem env fica "running" em crash-loop pra sempre.
 *     Por isso: running && !healthy ⇒ destroy() antes de startar de novo.
 *  2. A chave em startOptions é `envVars` (não `env`) — ver
 *     dist/types ContainerStartConfigOptions.
 * O binding D1 NÃO vaza pra dentro do container: buildEnv() só copia valores
 * de string, e env.DB é objeto.
 */
import { Container, getContainer } from '@cloudflare/containers';

export class UltravisServer extends Container {
  defaultPort = 80; // o Dockerfile expõe 80 (PORT default do server.js)
  // Maior que o intervalo do keepalive (10 min): o container só dorme se o
  // cron trigger falhar duas vezes seguidas.
  sleepAfter = '25m';

  // Todo env de string do worker (secrets do painel incluídos) + PORT/HOST
  // explícitos pro probe da plataforma (10.0.0.1:80).
  buildEnv() {
    const out = { PORT: '80', HOST: '0.0.0.0' };
    for (const [k, v] of Object.entries(this.env ?? {})) {
      if (typeof v === 'string' && v !== '') out[k] = v;
    }
    return out;
  }

  async fetch(request) {
    const state = await this.getState();
    if (this.ctx.container?.running && state.status !== 'healthy') {
      // Instância viva sem porta aberta = crash-loop com env do boot antigo.
      // Env só entra via start(), e start() é pulado com container running —
      // derruba pra renascer com a env certa.
      console.log(`container running sem healthy (${state.status}) — destroy pra reiniciar com env`);
      await this.destroy();
    }
    const envVars = this.buildEnv();
    // Só os NOMES no log (nunca valores) — é o que o tail precisa pra provar
    // que SUPABASE_URL & cia. foram no start.
    console.log('start envVars:', Object.keys(envVars).sort().join(','));
    await this.startAndWaitForPorts({ startOptions: { envVars }, ports: [80] });
    return super.fetch(request);
  }
}

// ─── Espelho D1 (rotas /espelho e /espelho/tabela/<nome>) ────────────────────
// Visualização SOMENTE LEITURA do banco D1 "ultravis-espelho" (binding DB).
// Veio do worker ultravis-d1-espelho, fundido aqui em 07/set — produção
// (Supabase) intocada; nenhum caminho de escrita.
//
// Segurança de query: nomes de tabela NUNCA vêm do usuário direto pro SQL —
// o nome pedido é validado contra a lista real do sqlite_master; só depois é
// interpolado (entre aspas duplas). Valores nunca são interpolados.

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: JSON_HEADERS });
}

// Interface HTML (navegador); API/curl continua recebendo JSON (?format=json força).

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function querBrowser(request, url) {
  if (url.searchParams.get('format') === 'json') return false;
  return (request.headers.get('accept') || '').includes('text/html');
}

function pagina(titulo, corpo) {
  const css =
    ':root{--bg:#F7F6F2;--card:#fff;--ink:#26251F;--ink2:#4C4940;--faint:#8C8878;--rule:#DFDCD2;--accent:#1F7A4D}' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{background:var(--bg);color:var(--ink);font-family:-apple-system,"IBM Plex Sans",sans-serif;font-size:15px;line-height:1.6;padding:34px 18px}' +
    '.wrap{max-width:820px;margin:0 auto}' +
    '.eyebrow{font-family:ui-monospace,monospace;font-size:.63rem;letter-spacing:.3em;text-transform:uppercase;color:var(--faint)}' +
    'h1{font-family:Georgia,serif;font-weight:500;font-size:1.7rem;margin:10px 0 4px}' +
    '.sub{color:var(--ink2);font-size:.88rem;margin-bottom:22px}' +
    '.card{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:6px 18px 14px;overflow-x:auto}' +
    'table{border-collapse:collapse;width:100%;font-size:.86rem}' +
    'th{text-align:left;font-family:ui-monospace,monospace;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);padding:10px 12px 6px;border-bottom:1px solid var(--rule)}' +
    'td{padding:7px 12px;border-bottom:1px solid #EFEDE6;font-variant-numeric:tabular-nums}' +
    'tr:last-child td{border-bottom:none}' +
    'td.num{text-align:right;font-family:ui-monospace,monospace}' +
    'a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}' +
    '.zero{color:var(--faint)}' +
    '.foot{margin-top:16px;font-size:.75rem;color:var(--faint)}';
  return new Response(
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(titulo) + '</title><style>' + css + '</style></head>' +
      '<body><div class="wrap">' + corpo + '</div></body></html>',
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );
}

function paginaIndice(contagens) {
  const linhas = contagens
    .map(
      (c) =>
        '<tr><td><a href="/espelho/tabela/' + escapeHtml(c.tabela) + '">' + escapeHtml(c.tabela) +
        '</a></td><td class="num' + (c.linhas === 0 ? ' zero' : '') + '">' + c.linhas + '</td></tr>'
    )
    .join('');
  const total = contagens.reduce((s, c) => s + c.linhas, 0);
  return pagina(
    'Espelho D1 — ultravis-espelho',
    '<div class="eyebrow">Ultravis · espelho D1 · fase A</div>' +
      '<h1>Banco <code>ultravis-espelho</code> no Cloudflare</h1>' +
      '<div class="sub">' + contagens.length + ' tabelas · ' + total +
      ' linhas no total — schema traduzido do Supabase; dados entram na fase B. Clique numa tabela para amostra.</div>' +
      '<div class="card"><table><thead><tr><th>tabela</th><th style="text-align:right">linhas</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>' +
      '<div class="foot">Somente leitura · produção (Supabase) intocada · <a href="/espelho?format=json">ver JSON</a></div>'
  );
}

function paginaTabela(nome, results) {
  let corpo;
  if (results.length === 0) {
    corpo = '<div class="card" style="padding:18px">Tabela vazia — dados entram na fase B do espelho.</div>';
  } else {
    const cols = Object.keys(results[0]);
    const head = cols.map((c) => '<th>' + escapeHtml(c) + '</th>').join('');
    const rows = results
      .map(
        (r) =>
          '<tr>' + cols.map((c) => '<td>' + escapeHtml(JSON.stringify(r[c]) ?? '') + '</td>').join('') + '</tr>'
      )
      .join('');
    corpo = '<div class="card"><table><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  return pagina(
    nome + ' — espelho D1',
    '<div class="eyebrow">Ultravis · espelho D1 · amostra (5 linhas)</div>' +
      '<h1><code>' + escapeHtml(nome) + '</code></h1>' +
      '<div class="sub"><a href="/espelho">← todas as tabelas</a></div>' + corpo +
      '<div class="foot"><a href="/espelho/tabela/' + escapeHtml(nome) + '?format=json">ver JSON</a></div>'
  );
}

// Tabelas reais do banco (exclui internas do SQLite e do D1).
async function listarTabelas(db) {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' " +
        "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    )
    .all();
  return results.map((r) => r.name);
}

async function servirEspelho(request, env, url, path) {
  if (request.method !== 'GET') {
    return json({ erro: 'método não suportado — use GET' }, 405);
  }
  if (!env.DB) {
    return json(
      {
        erro: 'binding DB ausente',
        remedio:
          'conferir o bloco d1_databases (banco "ultravis-espelho") no cloudflare/server-container/wrangler.jsonc',
      },
      500
    );
  }

  try {
    if (path === '/espelho') {
      const tabelas = await listarTabelas(env.DB);
      if (tabelas.length === 0) {
        return json({
          banco: 'ultravis-espelho',
          tabelas: [],
          aviso:
            'banco vazio — o schema é aplicado pelo workflow deploy-server-container (wrangler d1 execute --file=d1/schema.d1.sql)',
        });
      }
      // COUNT(*) por tabela num batch só (uma viagem ao D1).
      const stmts = tabelas.map((t) => env.DB.prepare('SELECT COUNT(*) AS n FROM "' + t + '"'));
      const resultados = await env.DB.batch(stmts);
      const contagens = tabelas.map((nome, i) => ({
        tabela: nome,
        linhas: resultados[i].results[0].n,
      }));
      if (querBrowser(request, url)) return paginaIndice(contagens);
      return json({
        banco: 'ultravis-espelho',
        total_tabelas: tabelas.length,
        tabelas: contagens,
        amostra: 'GET /espelho/tabela/<nome> devolve 5 linhas',
      });
    }

    const m = path.match(/^\/espelho\/tabela\/([A-Za-z0-9_]+)$/);
    if (m) {
      const pedido = m[1];
      const tabelas = await listarTabelas(env.DB);
      // Validação anti-injection: só nomes que EXISTEM no sqlite_master.
      const nome = tabelas.find((t) => t === pedido);
      if (!nome) {
        return json({ erro: 'tabela não encontrada', pedido, disponiveis: tabelas }, 404);
      }
      const { results } = await env.DB.prepare('SELECT * FROM "' + nome + '" LIMIT 5').all();
      if (querBrowser(request, url)) return paginaTabela(nome, results);
      return json({ tabela: nome, amostra: results, limite: 5 });
    }

    return json(
      { erro: 'rota não encontrada', rotas: ['GET /espelho', 'GET /espelho/tabela/<nome>'] },
      404
    );
  } catch (err) {
    return json({ erro: 'falha na consulta D1', detalhe: String(err && err.message) }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Normalização só para decidir o roteamento: o request que segue pro
    // container é sempre o ORIGINAL, sem reescrita de path.
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/espelho' || path.startsWith('/espelho/')) {
      return servirEspelho(request, env, url, path);
    }
    return getContainer(env.SERVER).fetch(request);
  },

  async scheduled(_controller, env) {
    // keepalive + healthcheck; o GET / do server responde 200
    const resp = await getContainer(env.SERVER).fetch('http://server/');
    console.log(JSON.stringify({ keepalive: resp.status }));
  },
};
