/**
 * Ultravis Server no Cloudflare — worker ÚNICO do produto.
 *
 * Um produto = um worker (decisão do dono, 07/set): o Express de server/ roda
 * INTACTO dentro do container (mesmo Dockerfile do Railway) e este Worker é a
 * frente dele:
 *  - fetch `/espelho*`: visualizador do espelho D1 (binding DB) e as duas
 *    pontes Supabase → D1 (agregados do censo e tabelas do produto) —
 *    atendido NA EDGE, nunca chega ao container;
 *  - fetch `/rules*` (e o apelido `/regras*`): documento de regras de negócio
 *    pra validação executiva (Basic auth PRÓPRIA, `REGRAS_ACESSOS` — o
 *    usuário que entra é o que assina as marcações) — também na edge;
 *  - fetch (qualquer outro caminho): vai pro container (API, /cloro/callback,
 *    /ops, tudo) — comportamento inalterado;
 *  - scheduled (cron a cada 10 min): keepalive — mantém o container acordado
 *    para o node-cron INTERNO continuar agendando censo/vigia/reviews.
 *
 * ATENÇÃO — `/espelho`, `/rules` e `/regras` são prefixos RESERVADOS da edge: o Express monta dois
 * routers na raiz (app.use('/', ...)), então uma rota `/espelho` criada lá no
 * futuro ficaria silenciosamente inalcançável. Conferido em 07/set: o Express
 * não usa nenhum caminho com esses prefixos (reconferido em 09/set).
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
import { sincronizarAgregados, lerAgregados } from './censo-espelho.js';
import { sincronizarTabelas } from './espelho-tabelas.js';
import { servirRegras } from './regras.js';

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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Resposta de erro que respeita o Accept: navegador ganha página, curl ganha JSON.
function erro(request, url, status, corpoJson, tituloHtml) {
  if (querBrowser(request, url)) {
    return pagina(
      tituloHtml,
      '<div class="eyebrow">Ultravis · espelho D1</div><h1>' +
        escapeHtml(tituloHtml) +
        '</h1><div class="sub"><a href="/espelho">← todas as tabelas</a></div>',
      status
    );
  }
  return json(corpoJson, status);
}

function querBrowser(request, url) {
  if (url.searchParams.get('format') === 'json') return false;
  return (request.headers.get('accept') || '').includes('text/html');
}

function pagina(titulo, corpo, status = 200) {
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
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
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
  const sub =
    contagens.length === 0
      ? 'Banco ainda sem schema — ele é aplicado pelo deploy (<code>wrangler d1 execute</code> com <code>d1/schema.d1.sql</code>).'
      : contagens.length + ' tabelas · ' + total +
        ' linhas no total — schema traduzido do Supabase; dados entram na fase B. Clique numa tabela para amostra.';
  return pagina(
    'Espelho D1 — ultravis-espelho',
    '<div class="eyebrow">Ultravis · espelho D1 · fase A</div>' +
      '<h1>Banco <code>ultravis-espelho</code> no Cloudflare</h1>' +
      '<div class="sub">' + sub + '</div>' +
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

function paginaCenso(linhas) {
  if (linhas.length === 0) {
    return pagina(
      'Censo — espelho D1',
      '<div class="eyebrow">Ultravis · censo na edge</div><h1>Sem agregados ainda</h1>' +
        '<div class="sub">A ponte roda no cron semanal (segunda, logo após o censo) ou sob demanda em ' +
        '<code>/espelho/sincronizar</code>. <a href="/espelho">← todas as tabelas</a></div>'
    );
  }
  const cab = ['dia', 'marca', 'motor', 'respostas', 'menções', 'citações', 'sent +/~/−']
    .map((c) => '<th>' + escapeHtml(c) + '</th>')
    .join('');
  const corpo = linhas
    .map(
      (l) =>
        '<tr><td>' + escapeHtml(l.dia) + '</td><td>' + escapeHtml(l.marca) + '</td><td>' +
        escapeHtml(l.motor) + '</td><td class="num">' + l.respostas + '</td><td class="num">' +
        l.mencoes + '</td><td class="num">' + l.citacoes + '</td><td class="num">' +
        l.sent_pos + '/' + l.sent_neu + '/' + l.sent_neg + '</td></tr>'
    )
    .join('');
  const tot = linhas.reduce(
    (a, l) => ({ n: a.n + l.respostas, m: a.m + l.mencoes, c: a.c + l.citacoes }),
    { n: 0, m: 0, c: 0 }
  );
  return pagina(
    'Censo — espelho D1',
    '<div class="eyebrow">Ultravis · censo na edge · últimos 8 dias</div>' +
      '<h1>Coleta por dia, marca e motor</h1>' +
      '<div class="sub">' + tot.n + ' respostas · ' + tot.m + ' menções · ' + tot.c +
      ' citações no período. Atualizado em ' + escapeHtml(linhas[0].atualizado_em || '—') +
      '. <a href="/espelho">← todas as tabelas</a></div>' +
      '<div class="card"><table><thead><tr>' + cab + '</tr></thead><tbody>' + corpo + '</tbody></table></div>' +
      '<div class="foot">Contagens agregadas — nenhum texto de resposta sai do Supabase · ' +
      '<a href="/espelho/censo?format=json">ver JSON</a></div>'
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

// Comparação em tempo constante: não vaza o tamanho nem o prefixo da senha
// pelo tempo de resposta.
function igualSeguro(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let dif = 0;
  for (let i = 0; i < x.length; i += 1) dif |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return dif === 0;
}

/**
 * Basic auth do espelho — MESMO par do /ops (OPS_USER/OPS_PASS, já secrets
 * deste worker). Roda ANTES de qualquer prepare()/batch() no D1: requisição
 * anônima não custa leitura faturada nem revela nome de tabela. Sem as envs
 * configuradas o espelho fica FECHADO (503), nunca aberto — a rota vive no
 * domínio de produção e D1 não tem RLS.
 */
function autorizado(request, env) {
  const user = env.OPS_USER;
  const pass = env.OPS_PASS;
  if (!user || !pass) return 'sem-credencial-configurada';
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;
  let decodificado = '';
  try {
    decodificado = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const corte = decodificado.indexOf(':');
  if (corte < 0) return false;
  // As duas comparações sempre executam — sem short-circuit por usuário errado.
  const okUser = igualSeguro(decodificado.slice(0, corte), user);
  const okPass = igualSeguro(decodificado.slice(corte + 1), pass);
  return okUser && okPass;
}

/**
 * Auth do /regras. Diferente do espelho em dois pontos que importam:
 *
 *  1. Vários pares, não um só — `REGRAS_ACESSOS` traz "usuario:senha" separados
 *     por vírgula. O documento é de validação executiva: precisa saber QUEM
 *     marcou cada regra, e um par compartilhado não distingue ninguém.
 *  2. Devolve o NOME de quem entrou, não um booleano — é esse nome que assina
 *     as marcações. Um login só serve às duas coisas.
 *
 * Todos os pares são comparados sempre, sem short-circuit no primeiro que bate:
 * sair mais cedo pro usuário certo entregaria, pelo tempo de resposta, quais
 * usuários existem.
 */
function quemEntrou(request, env) {
  const bruto = String(env.REGRAS_ACESSOS || '').trim();
  if (!bruto) return 'sem-credencial-configurada';
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('basic ')) return false;
  let decodificado = '';
  try {
    decodificado = atob(header.slice(6).trim());
  } catch {
    return false;
  }
  const corte = decodificado.indexOf(':');
  if (corte < 0) return false;
  const usuario = decodificado.slice(0, corte);
  const senha = decodificado.slice(corte + 1);

  let achado = '';
  for (const par of bruto.split(',')) {
    const meio = par.indexOf(':');
    if (meio < 0) continue;
    const u = par.slice(0, meio).trim();
    const p = par.slice(meio + 1).trim();
    if (igualSeguro(usuario, u) && igualSeguro(senha, p)) achado = u;
  }
  return achado || false;
}

function pedirCredencial(motivo, realm = 'espelho') {
  return new Response(JSON.stringify({ erro: motivo }, null, 2), {
    status: 401,
    headers: {
      ...JSON_HEADERS,
      'www-authenticate': `Basic realm="${realm}", charset="UTF-8"`,
    },
  });
}

async function servirEspelho(request, env, url, path) {
  if (request.method !== 'GET') {
    return json({ erro: 'método não suportado — use GET' }, 405);
  }
  const auth = autorizado(request, env);
  if (auth === 'sem-credencial-configurada') {
    // Fechado por falta de configuração — nunca aberto por omissão.
    return json(
      {
        erro: 'espelho indisponível',
        remedio: 'definir OPS_USER e OPS_PASS como Secret no worker ultravis-server',
      },
      503
    );
  }
  if (!auth) return pedirCredencial('autenticação necessária');
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
        // Banco sem schema ainda: navegador também merece página (o early-return
        // em JSON puro era um furo de UX visto na revisão).
        if (querBrowser(request, url)) return paginaIndice([]);
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

    // Números do censo (ponte Supabase → D1). Leitura barata: só o D1.
    if (path === '/espelho/censo') {
      const linhas = await lerAgregados(env.DB);
      if (querBrowser(request, url)) return paginaCenso(linhas);
      return json({ agregados: linhas, total: linhas.length });
    }

    // Enche o espelho com as tabelas do produto (marcas, prompts, resultados).
    // Sob demanda; o cron semanal roda junto com a ponte do censo.
    // `?dias=N` recorta a janela de prompt_results (padrão 90).
    if (path === '/espelho/sincronizar-tabelas') {
      const dias = Number.parseInt(url.searchParams.get('dias') || '', 10);
      const resumo = await sincronizarTabelas(env, Number.isFinite(dias) ? dias : undefined);
      return json(resumo, resumo.falhas ? 207 : 200);
    }

    // Dispara a sincronização sob demanda (o cron faz sozinho depois do censo).
    if (path === '/espelho/sincronizar') {
      const resumo = await sincronizarAgregados(env);
      return json({ ok: true, ...resumo });
    }

    const m = path.match(/^\/espelho\/tabela\/([A-Za-z0-9_]+)$/);
    if (m) {
      const pedido = m[1];
      const tabelas = await listarTabelas(env.DB);
      // Validação anti-injection: só nomes que EXISTEM no sqlite_master.
      const nome = tabelas.find((t) => t === pedido);
      if (!nome) {
        return erro(
          request,
          url,
          404,
          { erro: 'tabela não encontrada', pedido, disponiveis: tabelas },
          'Tabela não encontrada'
        );
      }
      const { results } = await env.DB.prepare('SELECT * FROM "' + nome + '" LIMIT 5').all();
      if (querBrowser(request, url)) return paginaTabela(nome, results);
      return json({ tabela: nome, amostra: results, limite: 5 });
    }

    return erro(
      request,
      url,
      404,
      { erro: 'rota não encontrada', rotas: ['GET /espelho', 'GET /espelho/tabela/<nome>'] },
      'Rota não encontrada'
    );
  } catch (err) {
    // Detalhe do erro fica no log do worker, não no corpo da resposta: a rota
    // vive no domínio de produção e mensagem de banco é informação interna.
    console.error('espelho: falha na consulta D1', err && err.message);
    return erro(request, url, 500, { erro: 'falha na consulta ao espelho' }, 'Falha na consulta');
  }
}

export default {
  async fetch(request, env) {
    // O roteamento do espelho não pode, em hipótese alguma, atrapalhar o
    // caminho da API: qualquer falha aqui cai pro container, que é o
    // comportamento de antes desta consolidação.
    try {
      const url = new URL(request.url);
      // Normalização só para decidir o roteamento: o request que segue pro
      // container é sempre o ORIGINAL, sem reescrita de path.
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (path === '/espelho' || path.startsWith('/espelho/')) {
        return await servirEspelho(request, env, url, path);
      }
      // Porta PRÓPRIA, separada da do /ops: aqui o login não é só a
      // fechadura, é a assinatura — quem entra como `igor` marca como Igor.
      // Um login só, o mesmo pra abrir e pra assinar.
      const baseRegras = ['/rules', '/regras'].find(
        (b) => path === b || path.startsWith(b + '/')
      );
      if (baseRegras) {
        const quem = quemEntrou(request, env);
        if (quem === 'sem-credencial-configurada') {
          return json(
            {
              erro: 'regras indisponíveis',
              remedio:
                'definir REGRAS_ACESSOS (formato "usuario:senha,usuario:senha") nas vars do worker ultravis-server',
            },
            503
          );
        }
        if (!quem) return pedirCredencial('autenticação necessária', 'regras ultravis');
        return await servirRegras(request, env, baseRegras, path.slice(baseRegras.length), quem);
      }
    } catch (err) {
      console.error('roteamento do espelho falhou — seguindo pro container', err && err.message);
    }
    return getContainer(env.SERVER).fetch(request);
  },

  async scheduled(controller, env, ctx) {
    // Dois crons, um handler: o semanal sincroniza os agregados do censo
    // (Supabase → D1); os demais são o keepalive que mantém o node-cron do
    // container vivo. A ponte nunca pode derrubar o keepalive — daí o catch.
    if (controller && controller.cron === '30 6 * * 1') {
      // As duas pontes no mesmo cron: os agregados (baratos) e as tabelas do
      // produto. Encadeadas, não em paralelo — o Supabase é o mesmo, e dois
      // varredores simultâneos só disputam a mesma conexão.
      const sincronizar = sincronizarAgregados(env)
        .then((r) => console.log(JSON.stringify({ ponte_censo: r })))
        .then(() => sincronizarTabelas(env))
        .then((r) => console.log(JSON.stringify({ ponte_tabelas: r })))
        .catch((err) => console.error('ponte do espelho falhou', err && err.message));
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(sincronizar);
      else await sincronizar;
    }
    const resp = await getContainer(env.SERVER).fetch('http://server/');
    console.log(JSON.stringify({ keepalive: resp.status }));
  },
};
