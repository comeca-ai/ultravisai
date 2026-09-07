// Ultravis D1 Espelho — worker de VISUALIZAÇÃO (somente leitura).
//
// Experimento aprovado pelo dono: espelho SQLite/D1 do schema Postgres do
// Supabase (ver ../schema.d1.sql e ../README.md). Produção intocada — este
// worker só lê o banco D1 "ultravis-espelho" (binding DB).
//
// Rotas:
//   GET /                → JSON: lista de tabelas + contagem de linhas de cada
//   GET /tabela/<nome>   → JSON: 5 linhas de amostra da tabela
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

// ─── Interface HTML (navegador) ──────────────────────────────────────────────
// Browser recebe página; API/curl continua recebendo JSON (?format=json força).

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
        '<tr><td><a href="/tabela/' + escapeHtml(c.tabela) + '">' + escapeHtml(c.tabela) +
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
      '<div class="foot">Somente leitura · produção (Supabase) intocada · <a href="/?format=json">ver JSON</a></div>'
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
      '<div class="sub"><a href="/">← todas as tabelas</a></div>' + corpo +
      '<div class="foot"><a href="/tabela/' + escapeHtml(nome) + '?format=json">ver JSON</a></div>'
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

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') {
      return json({ erro: 'método não suportado — use GET' }, 405);
    }
    if (!env.DB) {
      return json(
        {
          erro: 'binding DB ausente',
          remedio:
            'criar o banco D1 "ultravis-espelho" no painel e preencher database_id no wrangler.jsonc',
        },
        500
      );
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (path === '/') {
        const tabelas = await listarTabelas(env.DB);
        if (tabelas.length === 0) {
          return json({
            banco: 'ultravis-espelho',
            tabelas: [],
            aviso:
              'banco vazio — o schema é aplicado pelo workflow deploy-d1-espelho (wrangler d1 execute)',
          });
        }
        // COUNT(*) por tabela num batch só (uma viagem ao D1).
        const stmts = tabelas.map((t) =>
          env.DB.prepare('SELECT COUNT(*) AS n FROM "' + t + '"')
        );
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
          amostra: 'GET /tabela/<nome> devolve 5 linhas',
        });
      }

      const m = path.match(/^\/tabela\/([A-Za-z0-9_]+)$/);
      if (m) {
        const pedido = m[1];
        const tabelas = await listarTabelas(env.DB);
        // Validação anti-injection: só nomes que EXISTEM no sqlite_master.
        const nome = tabelas.find((t) => t === pedido);
        if (!nome) {
          return json({ erro: 'tabela não encontrada', pedido, disponiveis: tabelas }, 404);
        }
        const { results } = await env.DB
          .prepare('SELECT * FROM "' + nome + '" LIMIT 5')
          .all();
        if (querBrowser(request, url)) return paginaTabela(nome, results);
        return json({ tabela: nome, amostra: results, limite: 5 });
      }

      return json(
        { erro: 'rota não encontrada', rotas: ['GET /', 'GET /tabela/<nome>'] },
        404
      );
    } catch (err) {
      return json({ erro: 'falha na consulta D1', detalhe: String(err && err.message) }, 500);
    }
  },
};
