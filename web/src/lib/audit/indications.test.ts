import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildIndication, INDICATION_KEYS } from './indications';

describe('buildIndication', () => {
  it('returns null for pass/na regardless of signal', () => {
    expect(buildIndication('json-ld-presence', 'pass', {})).toBeNull();
    expect(buildIndication('faq-schema', 'na', {})).toBeNull();
  });

  it('returns null for unmapped signals (generic fix still renders)', () => {
    expect(buildIndication('page-weight', 'fail', {})).toBeNull();
  });

  it('json-ld-presence fail → start-from-Organization indication', () => {
    expect(buildIndication('json-ld-presence', 'fail', { blockCount: 0 })).toEqual({
      key: 'jsonLdPresence',
    });
  });

  it('json-ld-validity reports what was read: blocks, parsed, well-formed', () => {
    expect(
      buildIndication('json-ld-validity', 'warn', { blocks: 3, parsed: 2, wellFormedNodes: 1 }),
    ).toEqual({ key: 'jsonLdValidity', params: { blocks: 3, parsed: 2, wellFormed: 1 } });
  });

  it('json-ld-validity with zero blocks falls back to the presence indication', () => {
    expect(buildIndication('json-ld-validity', 'fail', { reason: 'no JSON-LD blocks' })).toEqual({
      key: 'jsonLdPresence',
    });
  });

  it('json-ld-relevance lists the types actually found on the site', () => {
    expect(
      buildIndication('json-ld-relevance', 'warn', { types: ['website', 'organization'] }),
    ).toEqual({ key: 'jsonLdRelevance', params: { types: 'website, organization' } });
    expect(buildIndication('json-ld-relevance', 'fail', { types: [] })).toEqual({
      key: 'jsonLdRelevanceNone',
    });
  });

  it('faq-schema distinguishes missing FAQPage from too-few questions', () => {
    expect(buildIndication('faq-schema', 'fail', { faqPage: false, questionCount: 0 })).toEqual({
      key: 'faqMissing',
    });
    expect(buildIndication('faq-schema', 'fail', { faqPage: true, questionCount: 1 })).toEqual({
      key: 'faqFew',
      params: { count: 1 },
    });
  });

  it('h1-quality: missing, multiple, and length cases carry the read evidence', () => {
    expect(buildIndication('h1-quality', 'fail', { count: 0, length: 0, text: '' })).toEqual({
      key: 'h1Missing',
    });
    expect(buildIndication('h1-quality', 'warn', { count: 3, length: 40, text: 'x' })).toEqual({
      key: 'h1Multiple',
      params: { count: 3 },
    });
    expect(buildIndication('h1-quality', 'warn', { count: 1, length: 12, text: 'Home' })).toEqual({
      key: 'h1Length',
      params: { length: 12, text: 'Home' },
    });
  });

  it('open-graph names the exact missing tags', () => {
    expect(
      buildIndication('open-graph', 'warn', {
        present: ['og:title'],
        missing: ['og:description', 'og:image', 'og:type'],
      }),
    ).toEqual({ key: 'openGraph', params: { missing: 'og:description, og:image, og:type' } });
  });

  it('ai-bot-access: blocked bots, missing robots.txt and silent robots.txt', () => {
    expect(
      buildIndication('ai-bot-access', 'fail', { aiBotsMentioned: ['gptbot'], blocked: true }),
    ).toEqual({ key: 'aiBotsBlocked', params: { bots: 'gptbot' } });
    expect(buildIndication('ai-bot-access', 'warn', { robotsTxt: false })).toEqual({
      key: 'robotsMissing',
    });
    expect(
      buildIndication('ai-bot-access', 'warn', { aiBotsMentioned: [], blocked: false }),
    ).toEqual({ key: 'aiBotsSilent' });
  });

  it('llms-txt-presence points at the ready-made generator', () => {
    expect(buildIndication('llms-txt-presence', 'fail', { llmsTxt: false })).toEqual({
      key: 'llmsTxt',
    });
  });
});

describe('i18n parity', () => {
  const load = (loc: string) =>
    JSON.parse(readFileSync(join(process.cwd(), 'messages', `${loc}.json`), 'utf-8')) as {
      audit: { indications?: Record<string, string>; indicationLabel?: string };
    };

  it.each(['pt-BR', 'en'])('%s has every indication key and the label', (loc) => {
    const audit = load(loc).audit;
    expect(audit.indicationLabel).toBeTruthy();
    for (const key of INDICATION_KEYS) {
      expect(audit.indications?.[key], `${loc}: audit.indications.${key}`).toBeTruthy();
    }
  });
});
