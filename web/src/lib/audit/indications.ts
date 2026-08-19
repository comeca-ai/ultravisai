/**
 * Ultravis addition (fork layer — additive module).
 *
 * "O que fazer" orientado por evidência (premissa v2, aprovada 19/ago):
 * a plataforma NÃO gera artefatos — ela LÊ o que o site tem (os sinais da
 * auditoria já parseiam o JSON-LD de verdade: blocos, validade, @types,
 * perguntas do FAQ, H1, OG, robots, llms.txt) e traduz a EVIDÊNCIA lida em
 * uma indicação específica do que precisa ser feito para as melhores
 * práticas — "encontramos X, falta Y", nunca conselho genérico.
 *
 * Camada pura: (signalKey, status, evidence) → chave i18n + params.
 * Os textos vivem em web/messages/*.json sob `audit.indications.*`; o teste
 * garante a paridade das chaves nos dois locales.
 */

export type IndicationStatus = 'pass' | 'warn' | 'fail' | 'na';

export interface Indication {
  /** i18n key under `audit.indications.*`. */
  key: string;
  params?: Record<string, string | number>;
}

/** Every i18n key this module can return — the parity test iterates this. */
export const INDICATION_KEYS = [
  'jsonLdPresence',
  'jsonLdValidity',
  'jsonLdRelevance',
  'jsonLdRelevanceNone',
  'faqMissing',
  'faqFew',
  'h1Missing',
  'h1Multiple',
  'h1Length',
  'openGraph',
  'llmsTxt',
  'aiBotsBlocked',
  'robotsMissing',
  'aiBotsSilent',
] as const;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/**
 * Builds the evidence-grounded indication for a non-passing signal.
 * Returns null when the signal passed, is not evaluated, or has no
 * specific indication mapped (the generic rubric fix still renders).
 */
export function buildIndication(
  signalKey: string,
  status: IndicationStatus,
  evidence: Record<string, unknown> | null | undefined,
): Indication | null {
  if (status === 'pass' || status === 'na') return null;
  const ev = evidence ?? {};

  switch (signalKey) {
    case 'json-ld-presence':
      return { key: 'jsonLdPresence' };

    case 'json-ld-validity': {
      const blocks = num(ev.blocks);
      if (blocks === 0) return { key: 'jsonLdPresence' };
      return {
        key: 'jsonLdValidity',
        params: { blocks, parsed: num(ev.parsed), wellFormed: num(ev.wellFormedNodes) },
      };
    }

    case 'json-ld-relevance': {
      const types = arr(ev.types);
      if (types.length === 0) return { key: 'jsonLdRelevanceNone' };
      return { key: 'jsonLdRelevance', params: { types: types.join(', ') } };
    }

    case 'faq-schema': {
      if (ev.faqPage === true) return { key: 'faqFew', params: { count: num(ev.questionCount) } };
      return { key: 'faqMissing' };
    }

    case 'h1-quality': {
      const count = num(ev.count);
      if (count === 0) return { key: 'h1Missing' };
      if (count > 1) return { key: 'h1Multiple', params: { count } };
      return {
        key: 'h1Length',
        params: { length: num(ev.length), text: String(ev.text ?? '').slice(0, 80) },
      };
    }

    case 'open-graph': {
      const missing = arr(ev.missing);
      if (missing.length === 0) return null;
      return { key: 'openGraph', params: { missing: missing.join(', ') } };
    }

    case 'llms-txt-presence':
      return { key: 'llmsTxt' };

    case 'ai-bot-access': {
      if (ev.blocked === true) {
        const bots = arr(ev.aiBotsMentioned);
        return { key: 'aiBotsBlocked', params: { bots: bots.join(', ') || '—' } };
      }
      if (ev.robotsTxt === false) return { key: 'robotsMissing' };
      return { key: 'aiBotsSilent' };
    }

    default:
      return null;
  }
}
