/**
 * Ultravis Server no Cloudflare — lift-and-shift via Containers (GA abr/2026).
 *
 * O Express de server/ roda INTACTO dentro do container (mesmo Dockerfile do
 * Railway). Este Worker é a frente dele:
 *  - fetch: todo request vai pro container (API, /cloro/callback, /ops, tudo);
 *  - scheduled (cron a cada 10 min): keepalive — mantém o container acordado para o
 *    node-cron INTERNO continuar agendando censo/vigia/reviews como sempre.
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
