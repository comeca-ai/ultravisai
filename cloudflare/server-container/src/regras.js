/**
 * `/rules` — o documento de regras de negócio servido pela edge.
 * (`/regras` responde igual: é o caminho com que a rota nasceu, mantido pra
 * não quebrar link já mandado.)
 *
 * Por que aqui e não num site estático: o documento é interno (traz as
 * divergências entre o que a landing promete e o que o código faz), então
 * precisa da mesma porta do /ops e do /espelho — Basic auth com OPS_USER/
 * OPS_PASS, conferida em index.js ANTES de chegar neste módulo.
 *
 * `/rules` e `/regras` são prefixos RESERVADOS da edge, pelo mesmo motivo do
 * `/espelho`: o Express monta routers na raiz, então uma rota com esses nomes
 * criada em server/ ficaria silenciosamente inalcançável. Conferido em 09/set:
 * o Express não usa nenhum dos dois (só `/t.js`, `/track/*`, `/ops*`).
 *
 * O HTML é o MESMO arquivo publicado como Artifact — importado de docs/ como
 * módulo de texto, sem cópia. Uma cópia aqui dentro ia divergir da outra na
 * primeira correção; já aconteceu duas vezes no mesmo dia com este arquivo.
 *
 * As marcações (confere / ajustar / não é isso) vivem no D1, no mesmo banco
 * do espelho. É o único estado que este worker ESCREVE — e é estado de
 * validação humana, não dado de cliente: se a tabela sumir, ninguém perde
 * produto, perde-se a rodada de revisão.
 */
import HTML from '../../../docs/regras-de-negocio-09set-v01.html';

// Os ids nascem do próprio documento (MET-01 … DIV-14). O formato é fechado
// de propósito: o PUT grava o que vier no path, e sem isto qualquer string
// viraria linha na tabela.
const ID_VALIDO = /^[A-Z]{3}-\d{2}$/;
const VEREDITOS = new Set(['ok', 'ajustar', 'errado', '']);
const LIMITE_NOTA = 2000;
const LIMITE_QUEM = 80;

// O usuário do login é o identificador; o nome com inicial maiúscula é o que
// aparece assinando a marcação ("igor" entra, "Igor" assina).
function exibir(usuario) {
  const u = String(usuario || '').trim();
  return u ? u.charAt(0).toUpperCase() + u.slice(1) : '';
}

/**
 * O arquivo de docs/ é o CORPO da página: quem publica o Artifact embrulha
 * num documento com charset e reset. Fora de lá esse embrulho não existe —
 * sem ele o navegador entra em quirks mode e os acentos quebram.
 *
 * `window.ULTRAVIS_API` é o que diz à página em que mundo ela está: definido,
 * ela grava as marcações por fetch aqui; ausente (no Artifact), ela usa a
 * capability `db`. Mesmo arquivo, dois back-ends. O valor sai do caminho pelo
 * qual a pessoa entrou, senão quem abrisse por `/regras` gravaria em `/rules`
 * — mesma rota, mas um redirecionamento a mais e a Basic auth pedida de novo.
 *
 * `window.ULTRAVIS_QUEM` carrega o nome de quem já passou pela Basic auth —
 * com ele a página pula a própria porta de entrada. É o que torna o login
 * único: uma senha abre e assina. No Artifact, onde não há Basic auth, a
 * variável não existe e a porta da página volta a aparecer.
 */
function documento(corpo, quem, base) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<style>
  :root{color-scheme:light}
  body{margin:0;font:14px system-ui,sans-serif}
  img{max-width:100%}
  [hidden]{display:none!important}
</style>
<script>
window.ULTRAVIS_API=${JSON.stringify(base + "/validacoes")};
window.ULTRAVIS_QUEM=${JSON.stringify(quem)};
</script>
</head>
<body>
${corpo}
</body>
</html>`;
}

function jsonRegras(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function garantirTabela(db) {
  // O schema do espelho é aplicado de forma TOLERANTE no deploy (pode falhar
  // sem derrubar a aplicação), então a tabela pode não existir quando a
  // primeira pessoa abrir a página. Criar aqui é barato e torna a rota
  // independente daquele passo.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS validacoes_regras (
         regra_id TEXT PRIMARY KEY,
         veredito TEXT NOT NULL DEFAULT '',
         nota     TEXT NOT NULL DEFAULT '',
         quem     TEXT NOT NULL DEFAULT '',
         em       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ'))
       )`
    )
    .run();
}

export async function servirRegras(request, env, base, resto, quem) {
  if (resto === '' || resto === '/') {
    if (request.method !== 'GET') {
      return jsonRegras({ erro: 'método não suportado — use GET' }, 405);
    }
    return new Response(documento(HTML, exibir(quem), base), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Documento interno: nada de cache compartilhado, e fora do índice.
        'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex, nofollow',
        'referrer-policy': 'no-referrer',
      },
    });
  }

  if (!env.DB) {
    return jsonRegras(
      {
        erro: 'binding DB ausente',
        remedio: 'conferir d1_databases no cloudflare/server-container/wrangler.jsonc',
      },
      500
    );
  }

  if (resto === '/validacoes' && request.method === 'GET') {
    await garantirTabela(env.DB);
    const { results } = await env.DB.prepare(
      'SELECT regra_id, veredito, nota, quem, em FROM validacoes_regras'
    ).all();
    const itens = {};
    for (const r of results || []) {
      itens[r.regra_id] = { v: r.veredito, nota: r.nota, quem: r.quem, em: r.em };
    }
    return jsonRegras({ itens });
  }

  if (resto.startsWith('/validacoes/') && request.method === 'PUT') {
    const id = resto.slice('/validacoes/'.length);
    if (!ID_VALIDO.test(id)) return jsonRegras({ erro: 'id de regra inválido' }, 400);

    let corpo;
    try {
      corpo = await request.json();
    } catch {
      return jsonRegras({ erro: 'corpo não é JSON' }, 400);
    }

    const v = String(corpo?.v ?? '');
    if (!VEREDITOS.has(v)) return jsonRegras({ erro: 'veredito inválido' }, 400);
    const nota = String(corpo?.nota ?? '').slice(0, LIMITE_NOTA);
    // A assinatura vem da Basic auth, NUNCA do corpo do PUT: se viesse do
    // corpo, quem entrasse como Jhon poderia gravar marcações assinadas Igor.
    const assinatura = exibir(quem).slice(0, LIMITE_QUEM);
    const em = new Date().toISOString();

    await garantirTabela(env.DB);
    await env.DB.prepare(
      `INSERT INTO validacoes_regras (regra_id, veredito, nota, quem, em)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(regra_id) DO UPDATE SET
         veredito = excluded.veredito,
         nota     = excluded.nota,
         quem     = excluded.quem,
         em       = excluded.em`
    )
      .bind(id, v, nota, assinatura, em)
      .run();

    return jsonRegras({ ok: true, id, v, nota, quem: assinatura, em });
  }

  return jsonRegras(
    {
      erro: 'rota não encontrada',
      rotas: [`GET ${base}`, `GET ${base}/validacoes`, `PUT ${base}/validacoes/<ID>`],
    },
    404
  );
}
