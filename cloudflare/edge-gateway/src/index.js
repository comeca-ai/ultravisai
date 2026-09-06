/**
 * Ultravis Edge Gateway — POC 1 da migração Cloudflare (ADR-9).
 *
 * O que ele é: a porta de entrada do webhook do Cloro rodando na edge.
 * O que ele NÃO é (ainda): o processamento — o corpo segue intacto pro
 * server atual (Railway), que continua dono da lógica. Isso torna o POC
 * reversível em minutos: apontar a URL do webhook de volta pro Railway
 * desfaz tudo.
 *
 * Por que existir, então:
 *  - prova o caminho Cloudflare com risco zero de lógica duplicada;
 *  - dá retry com backoff na entrega (hoje, se o Railway reiniciar no
 *    segundo errado, a entrega do Cloro se perde);
 *  - é o ponto onde, na fase 2, entra a fila: em vez de encaminhar,
 *    `env.CLORO_QUEUE.send(payload)` — o binding já fica documentado
 *    no wrangler.jsonc, comentado.
 *
 * Rotas:
 *  POST /cloro/callback  → encaminha corpo bruto + headers de assinatura
 *                          pro ORIGIN_URL; 2 tentativas extras em 5xx/rede.
 *  GET  /health          → estado do worker + alcance do origin.
 *  (o resto)             → 404 curto; a edge não expõe o server inteiro.
 */

const FORWARD_HEADERS = [
  'content-type',
  'x-cloro-signature',
  'x-cloro-timestamp',
  'x-cloro-webhook-id',
];

const RETRIES = 2; // além da 1ª tentativa
const RETRY_DELAY_MS = 400;

async function forwardCallback(request, env) {
  const rawBody = await request.arrayBuffer();
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set('x-forwarded-by', 'ultravis-edge-gateway');

  const target = new URL('/cloro/callback', env.ORIGIN_URL);
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    try {
      const resp = await fetch(target, { method: 'POST', headers, body: rawBody });
      // 4xx é veredito do origin (assinatura inválida etc.) — não repete.
      if (resp.status < 500) return resp;
      lastError = `origin ${resp.status}`;
    } catch (err) {
      lastError = String(err?.message ?? err);
    }
  }
  return Response.json(
    { error: 'origin unreachable after retries', detail: lastError },
    { status: 502 },
  );
}

async function health(env) {
  let origin = 'unreachable';
  try {
    const resp = await fetch(new URL('/', env.ORIGIN_URL), {
      signal: AbortSignal.timeout(5000),
    });
    origin = `http ${resp.status}`;
  } catch (err) {
    origin = `error: ${String(err?.message ?? err)}`;
  }
  return Response.json({ worker: 'ok', origin, originUrl: env.ORIGIN_URL });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === '/cloro/callback') {
      return forwardCallback(request, env);
    }
    if (request.method === 'GET' && pathname === '/health') {
      return health(env);
    }
    return new Response('not found', { status: 404 });
  },
};
