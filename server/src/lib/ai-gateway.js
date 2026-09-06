/**
 * Ultravis addition (fork layer): roteamento das chamadas de LLM pelo
 * Cloudflare AI Gateway.
 *
 * Por quê: o Claude ficou 28 dias falhando 401 em silêncio (incidente
 * 8/ago→6/set) porque as chamadas de provedor não têm painel próprio. Atrás
 * do gateway, cada chamada ganha log, custo, cache e retry num dashboard que
 * o dono já usa — e um 401 vira linha vermelha visível no dia 1.
 *
 * Comportamento: SÓ roteia quando AI_GATEWAY_ACCOUNT_ID está setado
 * (AI_GATEWAY_NAME default "ultravis"). Sem a env, tudo segue direto pros
 * provedores — mudança 100% reversível apagando a variável.
 *
 * BYOK/autenticação: se AI_GATEWAY_TOKEN estiver setado, o header
 * cf-aig-authorization vai junto — necessário quando o gateway está com
 * "Authenticated Gateway" ligado e permite guardar as chaves de provedor
 * NO gateway (aí as envs de chave podem até sair do Railway).
 *
 * Cada SDK monta o caminho de um jeito, então o sufixo é do call site:
 *   openai-tracker (SDK oficial, base .../v1)      → segment "openai"
 *   anthropic-tracker (SDK oficial, base raiz)     → segment "anthropic"
 *   @ai-sdk/openai (base .../v1)                   → segment "openai"
 *   @ai-sdk/anthropic (base .../v1)                → segment "anthropic/v1"
 *   @ai-sdk/google (base .../v1beta)               → segment "google-ai-studio/v1beta"
 */

const GATEWAY_HOST = 'https://gateway.ai.cloudflare.com/v1';

/**
 * Base URL do provedor via gateway, ou undefined para usar o endpoint direto.
 * @param {string} segment - caminho do provedor no gateway (ver tabela acima)
 * @returns {string | undefined}
 */
export function gatewayBaseURL(segment) {
  const accountId = process.env.AI_GATEWAY_ACCOUNT_ID;
  if (!accountId) return undefined;
  const name = process.env.AI_GATEWAY_NAME || 'ultravis';
  return `${GATEWAY_HOST}/${accountId}/${name}/${segment}`;
}

/**
 * Headers extras pro gateway (autenticação cf-aig), ou undefined.
 * @returns {Record<string, string> | undefined}
 */
export function gatewayHeaders() {
  if (!process.env.AI_GATEWAY_ACCOUNT_ID || !process.env.AI_GATEWAY_TOKEN) return undefined;
  return { 'cf-aig-authorization': `Bearer ${process.env.AI_GATEWAY_TOKEN}` };
}
