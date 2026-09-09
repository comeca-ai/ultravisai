/**
 * Ponte Supabase → D1: as TABELAS do produto, não só os agregados do censo.
 *
 * O espelho tinha as 39 tabelas criadas e nenhuma linha dentro — casca de
 * schema, 0 kB. Este módulo enche a espinha analítica: marcas, domínios,
 * concorrentes, tópicos, prompts e resultados de coleta.
 *
 * O que este espelho NÃO é: o banco. O Supabase continua sendo a fonte da
 * verdade — ele tem auth, RLS e os RPCs, e o D1 não tem nenhum dos três.
 * Aqui é leitura e experimento; escrita de produto nunca entra por este
 * caminho.
 *
 * ── A regra que não pode ser afrouxada ────────────────────────────────────
 *
 * Cada tabela declara a lista EXPLÍCITA de colunas. Nunca `select=*`.
 *
 * Não é preciosismo: `organizations` guarda `anthropic_api_key_encrypted`,
 * `stripe_customer_id` e `stripe_subscription_id`. Um `select=*` copiaria
 * chave de cliente e identificador de cobrança pra um banco que **não tem
 * RLS** — onde a única proteção é a senha da rota. Pelo mesmo motivo ficam
 * inteiras de fora as tabelas `profiles`, `invitations`, `api_keys`,
 * `webhook_configs`, `agent_conversations`, `agent_messages` e
 * `ai_traffic_logs`: são pessoa, credencial ou conversa, e nada disso é
 * necessário pra analisar visibilidade de marca.
 *
 * `prompt_results.response` — o texto inteiro da resposta da IA — também
 * fica fora, por volume: é a maior coluna do banco e nenhuma análise que o
 * espelho serve precisa dela. `citations` entra, porque é dela que sai toda
 * a conta de citação.
 */

/** Quantas linhas o PostgREST devolve por página. */
const PAGINA = 1000;
/** Teto por tabela, pra uma marca nova não derrubar o worker sem querer. */
const TETO_POR_TABELA = 50_000;
/** D1 aceita lote grande, mas lote enorme estoura o limite de subrequests. */
const LOTE = 200;
/** Janela padrão dos resultados de coleta, em dias. */
const JANELA_DIAS = 90;

/**
 * A espinha analítica, em ordem de dependência (pai antes de filho): se o
 * schema D1 ganhar FOREIGN KEY um dia, a ordem já está certa.
 *
 * `janela` marca a tabela que é grande e cresce pra sempre — só ela recorta
 * por data; as outras são pequenas e vão inteiras, o que mantém o espelho
 * consistente com a produção em vez de meio atualizado.
 */
const TABELAS = [
  {
    nome: 'organizations',
    // Só o que identifica e classifica. Nada de Stripe, nada de chave de IA.
    colunas: ['id', 'name', 'slug', 'created_at', 'plan', 'subscription_status'],
  },
  {
    nome: 'brands',
    colunas: [
      'id',
      'organization_id',
      'name',
      'slug',
      'industry',
      'description',
      'created_at',
      'region',
      'language',
      'is_active',
      'aliases',
    ],
  },
  {
    nome: 'brand_domains',
    colunas: ['id', 'brand_id', 'domain', 'country', 'is_primary', 'created_at'],
  },
  {
    nome: 'competitors',
    colunas: ['id', 'brand_id', 'name', 'domain', 'created_at'],
  },
  {
    nome: 'topics',
    colunas: ['id', 'brand_id', 'name', 'is_active', 'created_at'],
  },
  {
    nome: 'prompt_sets',
    colunas: ['id', 'brand_id', 'name', 'created_at'],
  },
  {
    nome: 'prompts',
    colunas: [
      'id',
      'prompt_set_id',
      'text',
      'category',
      'platforms',
      'is_active',
      'created_at',
      'regions',
      'models',
      'topic_id',
      'is_brand_prompt',
    ],
  },
  {
    nome: 'prompt_results',
    // `response` fora de propósito — ver o cabeçalho.
    colunas: [
      'id',
      'prompt_id',
      'brand_id',
      'platform',
      'citations',
      'mention_count',
      'citation_count',
      'sentiment',
      'visibility_score',
      'model_used',
      'created_at',
      'region',
      'competitor_mentions',
      'appearance_rank',
      'appearance_rivals',
    ],
    janela: 'created_at',
  },
];

/** GET paginado no PostgREST com a service role (somente leitura). */
async function lerPagina(env, tabela, colunas, filtro, offset) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !chave) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no worker');

  const url =
    `${base}/rest/v1/${tabela}?select=${colunas.join(',')}` +
    (filtro ? `&${filtro}` : '') +
    // Ordem estável: sem ela as páginas se embaralham entre requisições e o
    // espelho fica com linha repetida e linha faltando ao mesmo tempo.
    `&order=id.asc&limit=${PAGINA}&offset=${offset}`;

  const resp = await fetch(url, {
    headers: { apikey: chave, authorization: `Bearer ${chave}`, accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`supabase ${resp.status} em ${tabela}`);
  return resp.json();
}

/**
 * Converte um valor do PostgREST pro que o SQLite aceita como parâmetro.
 * O schema D1 traduz `jsonb` e `text[]` para TEXT com JSON e `boolean` para
 * INTEGER 0/1 — sem isto, o bind falha ou grava "[object Object]".
 */
function paraSqlite(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
}

async function espelharTabela(env, tabela, dias) {
  const { nome, colunas, janela } = tabela;
  const filtro = janela
    ? `${janela}=gte.${new Date(Date.now() - dias * 86400000).toISOString()}`
    : '';

  // Lê tudo ANTES de apagar qualquer coisa: se o Supabase falhar no meio, o
  // espelho continua com a cópia anterior em vez de ficar vazio.
  const linhas = [];
  for (let offset = 0; offset < TETO_POR_TABELA; offset += PAGINA) {
    const pagina = await lerPagina(env, nome, colunas, filtro, offset);
    linhas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }

  const marcadores = colunas.map(() => '?').join(', ');
  const insert = `INSERT OR REPLACE INTO ${nome} (${colunas.join(', ')}) VALUES (${marcadores})`;

  // Substituição da fatia inteira: idempotente, então rodar duas vezes
  // seguidas não duplica nada.
  await env.DB.prepare(janela ? `DELETE FROM ${nome} WHERE ${janela} >= ?` : `DELETE FROM ${nome}`)
    .bind(...(janela ? [new Date(Date.now() - dias * 86400000).toISOString()] : []))
    .run();

  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE);
    await env.DB.batch(
      fatia.map((l) => env.DB.prepare(insert).bind(...colunas.map((c) => paraSqlite(l[c])))),
    );
  }

  return { tabela: nome, linhas: linhas.length, janela_dias: janela ? dias : null };
}

/**
 * Enche o espelho com a espinha analítica. Retorna o resumo por tabela.
 *
 * Uma tabela que falha não derruba as outras: o espelho é experimento, e meio
 * espelho com o erro nomeado vale mais que nenhum espelho e um stack trace.
 */
export async function sincronizarTabelas(env, dias = JANELA_DIAS) {
  if (!env.DB) throw new Error('binding DB ausente — sem D1 não há onde gravar');

  const resultados = [];
  for (const tabela of TABELAS) {
    try {
      resultados.push(await espelharTabela(env, tabela, dias));
    } catch (err) {
      resultados.push({ tabela: tabela.nome, erro: (err && err.message) || String(err) });
    }
  }

  return {
    atualizado_em: new Date().toISOString(),
    janela_dias: dias,
    tabelas: resultados,
    total_linhas: resultados.reduce((s, r) => s + (r.linhas || 0), 0),
    falhas: resultados.filter((r) => r.erro).length,
  };
}
