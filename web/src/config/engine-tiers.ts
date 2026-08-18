/**
 * Ultravis addition (fork layer).
 *
 * Motores × pacote comercial — tabela definida pelo dono em 18/ago (CSV da
 * sessão), fonte da verdade para o futuro gate por plano (pacotes Sinal /
 * Alcance / Domínio do doc de 17/ago). Cada motor carrega a tag do MENOR
 * pacote que o inclui; pacotes maiores herdam os menores (6 ⊃ 4, 9 ⊃ 6).
 *
 * | Pacote    | Composição                                   | Lógica comercial                                  |
 * |-----------|----------------------------------------------|---------------------------------------------------|
 * | 4 motores | ChatGPT + AI Overviews + Gemini + AI Mode    | Máxima exposição BR + aposta do Google; massa     |
 * | 6 motores | + Copilot + Perplexity                       | Camada corporativa + early-adopter/citações       |
 * | 9 motores | + Claude + Grok + 1 slot aberto              | Cobertura total                                   |
 *
 * O "1 slot aberto" do pacote 9 aguarda validação técnica (candidatos
 * DeepMind/Minimax — decisão registrada em 17/ago: validar antes de virar
 * promessa). Quando definido, entra aqui com tier 9.
 *
 * Slugs seguem `prompt_results.platform` (ver platform-labels.ts). O Claude
 * roda via API Anthropic (fase 2 do worker) e grava platform = 'claude'.
 */

export type EngineTier = 4 | 6 | 9;

export const ENGINE_TIERS: Record<string, EngineTier> = {
  // Pacote 4 motores — exposição de massa BR + aposta do Google.
  'chatgpt-web': 4,
  'google-aio': 4,
  'gemini-web': 4,
  'google-aimode': 4,

  // Pacote 6 motores — camada corporativa + early-adopter/citações.
  'copilot-web': 6,
  'perplexity-web': 6,

  // Pacote 9 motores — cobertura total (+ 1 slot aberto a validar).
  claude: 9,
  'grok-web': 9,
};

/** Rótulo curto da tag de cada tier (UI de operador / futuro pricing). */
export const TIER_LABELS: Record<EngineTier, string> = {
  4: '4 motores',
  6: '6 motores',
  9: '9 motores',
};

/** Motores incluídos num pacote (tiers menores inclusos). */
export function enginesForTier(tier: EngineTier): string[] {
  return Object.entries(ENGINE_TIERS)
    .filter(([, t]) => t <= tier)
    .map(([slug]) => slug);
}

/** Tag do menor pacote que inclui o motor; null = motor fora da tabela. */
export function tierOfEngine(platformSlug: string): EngineTier | null {
  return ENGINE_TIERS[platformSlug] ?? null;
}
