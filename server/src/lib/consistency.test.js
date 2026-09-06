import { describe, it, expect } from 'vitest';
import { evaluateConsistency, normalizeName } from './consistency.js';

const NOW = new Date('2026-08-19T12:00:00Z');

/** Snapshot saudável: nada dispara. */
const healthy = {
  brands: [
    { id: 'b1', organizationId: 'o1', name: 'Polar', aliases: ['Polar Brasil'], isActive: true },
    { id: 'b2', organizationId: 'o2', name: 'Certeiro', aliases: [], isActive: true },
  ],
  competitors: [
    { brandId: 'b1', name: 'Garmin', domain: 'garmin.com' },
    { brandId: 'b1', name: 'Suunto', domain: 'suunto.com' },
  ],
  brandDomains: [
    { brandId: 'b1', domain: 'polar.com' },
    { brandId: 'b2', domain: 'certeiro.com.br' },
  ],
  indexWeights: [
    { dimKey: 'dim1', weight: 15 },
    { dimKey: 'dim2', weight: 20 },
    { dimKey: 'dim3', weight: 12 },
    { dimKey: 'dim4', weight: 18 },
    { dimKey: 'dim5', weight: 22 },
    { dimKey: 'dim6', weight: 13 },
  ],
  prompts: [
    {
      brandId: 'b1',
      platforms: ['chatgpt-web', 'gemini-web'],
      models: [],
      text: 'O que é a Polar?',
      isBrandPrompt: true,
    },
    {
      brandId: 'b1',
      platforms: ['chatgpt-web', 'gemini-web'],
      models: [],
      text: 'melhores relógios esportivos',
      isBrandPrompt: false,
    },
  ],
  recentResults: Array.from({ length: 20 }, (_, i) => ({
    brandId: 'b1',
    platform: i % 2 === 0 ? 'chatgpt-web' : 'gemini-web',
    mentionCount: 1,
    citationCount: 0,
    appearanceRank: 1,
    sentiment: 'neutral',
  })),
  stalledRankRows: 0,
  recountSample: { total: 100, divergent: 0 },
};

describe('normalizeName', () => {
  it('strips diacritics, case and extra spaces', () => {
    expect(normalizeName('  Ana  Coutô ')).toBe('ana couto');
  });
});

describe('evaluateConsistency', () => {
  it('returns no alerts for a healthy snapshot', () => {
    expect(evaluateConsistency(healthy, NOW)).toEqual([]);
  });

  it('flags duplicated competitor names within a brand (caso Garmin)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        competitors: [
          ...healthy.competitors,
          { brandId: 'b1', name: ' garmin ', domain: 'garmin.com.br' },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-dup-competitors');
    expect(hit?.severity).toBe('critical');
    expect(hit?.message).toContain('garmin');
    expect(hit?.message).toContain('Polar');
  });

  it('flags near-identical active brands in the same org (caso Polar)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        brands: [
          ...healthy.brands,
          { id: 'b3', organizationId: 'o1', name: 'Polar Electro', aliases: [], isActive: true },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-sibling-brands');
    expect(hit?.message).toContain('"Polar" × "Polar Electro"');
  });

  it('ignores near-identical brands when one is inactive or in another org', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        brands: [
          ...healthy.brands,
          { id: 'b3', organizationId: 'o1', name: 'Polar Electro', aliases: [], isActive: false },
          { id: 'b4', organizationId: 'o9', name: 'Polar', aliases: [], isActive: true },
        ],
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-sibling-brands')).toBeUndefined();
  });

  it('does NOT flag www/protocol domains — extractHostname normaliza os dois', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        brandDomains: [
          { brandId: 'b1', domain: 'www.polar.com' },
          { brandId: 'b2', domain: 'https://certeiro.com.br' },
        ],
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-pathed-domains')).toBeUndefined();
    expect(alerts.find((a) => a.key === 'consistency-broken-domains')).toBeUndefined();
  });

  it('flags a domain with a path — qualquer link daquele host contaria como seu', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        competitors: [
          ...healthy.competitors,
          { brandId: 'b1', name: 'Jefferson', domain: 'linktr.ee/jeffersonfbarbosa' },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-pathed-domains');
    expect(hit?.message).toContain('linktr.ee');
  });

  it('flags a domain that normalizes to no host at all', () => {
    const alerts = evaluateConsistency(
      { ...healthy, brandDomains: [{ brandId: 'b1', domain: '/// ' }] },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-broken-domains')).toBeTruthy();
  });

  it('flags brand prompts that contain no known spelling of the brand (caso Anacouto)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: [
          ...healthy.prompts,
          {
            brandId: 'b2',
            platforms: ['chatgpt-web'],
            text: 'O que é a Certeira?',
            isBrandPrompt: true,
          },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-brand-prompt-no-term');
    expect(hit?.message).toContain('Certeiro: 1 prompt(s)');
  });

  it('accepts brand prompts matched via alias or domain, accent-insensitive', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: [
          {
            brandId: 'b1',
            platforms: ['chatgpt-web'],
            text: 'A POLÁR Brasil é boa?',
            isBrandPrompt: true,
          },
          {
            brandId: 'b2',
            platforms: ['chatgpt-web'],
            text: 'reviews de certeiro.com.br',
            isBrandPrompt: true,
          },
        ],
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-brand-prompt-no-term')).toBeUndefined();
  });

  it('flags index weights that do not sum to 100', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        indexWeights: [
          { dimKey: 'dim1', weight: 50 },
          { dimKey: 'dim2', weight: 60 },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-index-weights-sum');
    expect(hit?.severity).toBe('critical');
    expect(hit?.message).toContain('175');
  });

  it('stays quiet when index weights are absent (table not readable)', () => {
    const alerts = evaluateConsistency({ ...healthy, indexWeights: [] }, NOW);
    expect(alerts.find((a) => a.key === 'consistency-index-weights-sum')).toBeUndefined();
  });

  it('flags an engine configured on prompts that delivered nothing while others ran (casos Claude/Grok)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: healthy.prompts.map((p) => ({
          ...p,
          platforms: [...p.platforms, 'claude'],
        })),
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-engine-silent');
    expect(hit?.severity).toBe('critical');
    expect(hit?.message).toContain('claude');
    expect(hit?.message).toContain('Polar');
  });

  it('does not judge engine silence on brands with too few rows in the window', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        recentResults: healthy.recentResults.slice(0, 5),
        prompts: healthy.prompts.map((p) => ({ ...p, platforms: [...p.platforms, 'claude'] })),
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-engine-silent')).toBeUndefined();
  });

  it('flags impossible rows: negative counts, rank without mention, unknown sentiment', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        recentResults: [
          ...healthy.recentResults,
          {
            brandId: 'b1',
            platform: 'chatgpt-web',
            mentionCount: -1,
            citationCount: 0,
            appearanceRank: null,
            sentiment: 'neutral',
          },
          {
            brandId: 'b1',
            platform: 'chatgpt-web',
            mentionCount: 0,
            citationCount: 0,
            appearanceRank: 2,
            sentiment: 'neutral',
          },
          {
            brandId: 'b1',
            platform: 'chatgpt-web',
            mentionCount: 1,
            citationCount: 0,
            appearanceRank: 1,
            sentiment: 'mixed',
          },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-impossible-rows');
    expect(hit?.severity).toBe('critical');
    expect(hit?.message).toContain('1 com contagem negativa');
    expect(hit?.message).toContain('1 com posição de aparição sem menção');
    expect(hit?.message).toContain('1 com sentimento fora do vocabulário');
  });

  it('does not treat appearance_rank 0 (não computável) as impossible', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        recentResults: [
          ...healthy.recentResults,
          {
            brandId: 'b1',
            platform: 'chatgpt-web',
            mentionCount: 0,
            citationCount: 0,
            appearanceRank: 0,
            sentiment: 'neutral',
          },
        ],
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-impossible-rows')).toBeUndefined();
  });

  it('flags results whose platform no prompt configures (rows vanish from per-engine bars)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        recentResults: [
          ...healthy.recentResults,
          {
            brandId: 'b1',
            platform: 'perplexity-web',
            mentionCount: 1,
            citationCount: 0,
            appearanceRank: 1,
            sentiment: 'neutral',
          },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-unknown-platform');
    expect(hit?.message).toContain('perplexity-web: 1 linha(s)');
  });

  it('flags a stalled appearance-rank backlog', () => {
    const alerts = evaluateConsistency({ ...healthy, stalledRankRows: 42 }, NOW);
    const hit = alerts.find((a) => a.key === 'consistency-rank-backlog');
    expect(hit?.message).toContain('42');
  });

  it('detects a silent API engine configured via prompt.models (caso Claude real)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: healthy.prompts.map((p) => ({ ...p, models: ['claude-sonnet-5'] })),
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-engine-silent');
    expect(hit?.message).toContain('claude');
  });

  it('does not flag chatgpt-shopping as silent when configured but shopping is off', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: healthy.prompts.map((p) => ({
          ...p,
          platforms: [...p.platforms, 'chatgpt-shopping'],
        })),
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-engine-silent')).toBeUndefined();
  });

  it('treats chatgpt-shopping and API-model platforms as known (no unknown-platform alert)', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        prompts: healthy.prompts.map((p) => ({ ...p, models: ['claude-sonnet-5'] })),
        recentResults: [
          ...healthy.recentResults,
          {
            brandId: 'b1',
            platform: 'chatgpt-shopping',
            mentionCount: 1,
            citationCount: 0,
            appearanceRank: 1,
            sentiment: 'neutral',
          },
          {
            brandId: 'b1',
            platform: 'claude',
            mentionCount: 1,
            citationCount: 0,
            appearanceRank: 1,
            sentiment: 'neutral',
          },
        ],
      },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-unknown-platform')).toBeUndefined();
  });

  it('index weights: partial table row equal to default keeps the effective sum at 100', () => {
    const alerts = evaluateConsistency(
      { ...healthy, indexWeights: [{ dimKey: 'dim1', weight: 15 }] },
      NOW,
    );
    expect(alerts.find((a) => a.key === 'consistency-index-weights-sum')).toBeUndefined();
  });

  it('index weights: rows summing 100 alone still alert when the EFFECTIVE merge breaks', () => {
    const alerts = evaluateConsistency(
      {
        ...healthy,
        indexWeights: [
          { dimKey: 'dim1', weight: 50 },
          { dimKey: 'dim2', weight: 50 },
        ],
      },
      NOW,
    );
    const hit = alerts.find((a) => a.key === 'consistency-index-weights-sum');
    expect(hit?.message).toContain('165');
  });

  it('flags systematic mention recount drift, but tolerates isolated rows', () => {
    const quiet = evaluateConsistency(
      { ...healthy, recountSample: { total: 100, divergent: 2 } },
      NOW,
    );
    expect(quiet.find((a) => a.key === 'consistency-mention-recount')).toBeUndefined();

    const loud = evaluateConsistency(
      { ...healthy, recountSample: { total: 100, divergent: 15 } },
      NOW,
    );
    const hit = loud.find((a) => a.key === 'consistency-mention-recount');
    expect(hit?.message).toContain('15 de 100');
  });
});
