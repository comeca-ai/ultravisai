/**
 * Ponte Supabase → D1: agregados do censo na edge.
 *
 * Problema que isto resolve: a produção (Supabase) só é legível por quem tem a
 * SERVICE_ROLE — que vive como Secret no worker e, por desenho, não sai de lá.
 * Resultado prático: ninguém fora do painel conseguia responder "o censo de hoje
 * coletou quanto?" sem colar credencial em mais um lugar.
 *
 * Aqui o worker — que JÁ tem a chave — lê o Supabase, agrega (contagens, nunca
 * conteúdo) e grava no D1. Daí a leitura vira barata e auditável: a rota
 * /espelho/censo mostra pro dono e o pipeline lê o mesmo dado com
 * `wrangler d1 execute`, sem que nenhuma credencial nova precise existir.
 *
 * O que NÃO vai pro D1: texto de resposta, citações, qualquer dado de usuário.
 * Só números por (dia × marca × motor).
 */

const LIMITE_LINHAS = 10000;

/** GET no PostgREST do Supabase com a service role (somente leitura). */
async function lerSupabase(env, caminho) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const chave = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !chave) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no worker');
  const resp = await fetch(base + '/rest/v1/' + caminho, {
    headers: { apikey: chave, authorization: 'Bearer ' + chave, accept: 'application/json' },
  });
  if (!resp.ok) throw new Error('supabase ' + resp.status + ' em ' + caminho.split('?')[0]);
  return resp.json();
}

/**
 * Lê a janela recente do Supabase e regrava a tabela de agregados no D1.
 * Idempotente: apaga e reescreve a janela inteira, então rodar duas vezes
 * seguidas não duplica nada.
 */
export async function sincronizarAgregados(env, dias = 8) {
  if (!env.DB) throw new Error('binding DB ausente — sem D1 não há onde gravar');

  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const marcas = await lerSupabase(env, 'brands?select=id,name,status');
  const nomePorId = new Map(marcas.map((b) => [b.id, b.name]));

  const linhas = await lerSupabase(
    env,
    'prompt_results?select=brand_id,platform,mention_count,citation_count,sentiment,created_at' +
      '&created_at=gte.' +
      desde +
      'T00:00:00Z&limit=' +
      LIMITE_LINHAS
  );

  // Agrega em memória: (dia, marca, motor) → contagens.
  const mapa = new Map();
  for (const r of linhas) {
    const dia = String(r.created_at || '').slice(0, 10);
    const marca = nomePorId.get(r.brand_id) || String(r.brand_id || '').slice(0, 8);
    const motor = r.platform || '(sem motor)';
    const chave = dia + '|' + marca + '|' + motor;
    let a = mapa.get(chave);
    if (!a) {
      a = { dia, marca, motor, n: 0, m: 0, c: 0, pos: 0, neu: 0, neg: 0 };
      mapa.set(chave, a);
    }
    a.n += 1;
    a.m += Number(r.mention_count) || 0;
    a.c += Number(r.citation_count) || 0;
    if (r.sentiment === 'positive') a.pos += 1;
    else if (r.sentiment === 'negative') a.neg += 1;
    else a.neu += 1;
  }

  const agora = new Date().toISOString();
  const stmts = [
    env.DB.prepare('DELETE FROM censo_agregados WHERE dia >= ?').bind(desde),
    ...Array.from(mapa.values()).map((a) =>
      env.DB.prepare(
        'INSERT INTO censo_agregados (dia, marca, motor, respostas, mencoes, citacoes, sent_pos, sent_neu, sent_neg, atualizado_em) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(a.dia, a.marca, a.motor, a.n, a.m, a.c, a.pos, a.neu, a.neg, agora)
    ),
  ];
  await env.DB.batch(stmts);

  return {
    janela_dias: dias,
    desde,
    linhas_lidas: linhas.length,
    grupos: mapa.size,
    atualizado_em: agora,
  };
}

/** Lê os agregados já sincronizados (barato — só o D1, sem tocar no Supabase). */
export async function lerAgregados(db, dias = 8) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      'SELECT dia, marca, motor, respostas, mencoes, citacoes, sent_pos, sent_neu, sent_neg, atualizado_em ' +
        'FROM censo_agregados WHERE dia >= ? ORDER BY dia DESC, marca, motor'
    )
    .bind(desde)
    .all();
  return results || [];
}
