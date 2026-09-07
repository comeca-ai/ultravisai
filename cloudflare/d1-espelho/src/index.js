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
