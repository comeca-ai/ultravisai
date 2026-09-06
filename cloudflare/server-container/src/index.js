/**
 * Ultravis Server no Cloudflare — lift-and-shift via Containers (GA abr/2026).
 *
 * O Express de server/ roda INTACTO dentro do container (mesmo Dockerfile do
 * Railway). Este Worker é a frente dele:
 *  - fetch: todo request vai pro container (API, /cloro/callback, /ops, tudo);
 *  - scheduled (cron a cada 10 min): keepalive — mantém o container acordado para o
 *    node-cron INTERNO continuar agendando censo/vigia/reviews como sempre.
 *    (v2: destilar cada agenda em Cron Triggers nativos chamando os endpoints
 *    /api/internal/* com CRON_SECRET; aí o keepalive morre e o container
 *    dorme entre execuções.)
 *
 * Segredos: setados NO WORKER (painel ou sync-cf-secrets) e repassados ao
 * container via envVars — mesma lista do Railway.
 */
import { Container, getContainer } from '@cloudflare/containers';

const PASS_ENV = [
  'NODE_ENV',
  'IS_CLOUD',
  'PLATFORM_PROVIDER',
  'ALLOWED_ORIGINS',
  'PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'CLORO_API_KEY',
  'CLORO_WEBHOOK_URL',
  'CLORO_WEBHOOK_SECRET',
  'SCRAPEDO_API_KEY',
  'CRON_SECRET',
  'DAILY_CRON_SCHEDULE',
  'AUDIT_LLM_MODEL',
  'DEFAULT_SUGGESTION_MODEL',
  'PROMPT_SUGGESTION_MODEL',
  'TOPIC_SUGGESTION_MODEL',
  'COMPETITOR_SUGGESTION_MODEL',
  'AI_GATEWAY_ACCOUNT_ID',
  'AI_GATEWAY_NAME',
  'AI_GATEWAY_TOKEN',
];

export class UltravisServer extends Container {
  defaultPort = 80; // o Dockerfile expõe 80 (PORT default do server.js)
  // Maior que o intervalo do keepalive (10 min): o container só dorme se o
  // cron trigger falhar duas vezes seguidas.
  sleepAfter = '25m';

  get envVars() {
    const out = {};
    for (const k of PASS_ENV) {
      const v = this.env?.[k];
      if (v !== undefined && v !== null && v !== '') out[k] = String(v);
    }
    return out;
  }
}

export default {
  async fetch(request, env) {
    return getContainer(env.SERVER).fetch(request);
  },

  async scheduled(_controller, env) {
    // keepalive + healthcheck; o GET / do server responde 200
    const resp = await getContainer(env.SERVER).fetch('http://server/');
    console.log(JSON.stringify({ keepalive: resp.status }));
  },
};
