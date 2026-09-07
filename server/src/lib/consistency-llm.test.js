import { describe, it, expect, afterEach } from 'vitest';
import {
  CONSISTENCY_LLM_DEFAULT_CRON,
  resolveConsistencyLlmModel,
  summarizeBrandMetrics,
  findingsToAlerts,
  buildPrompt,
  getLlmConsistencyAlerts,
  _resetLlmConsistencyCache,
  runConsistencyLlmOnce,
} from './consistency-llm.js';

const brands = [
  { id: 'b1', name: 'Polar', isActive: true },
  { id: 'b2', name: 'Arquivada', isActive: false },
  { id: 'b3', name: 'Sem Dados', isActive: true },
];

const results = [
  // Polar / chatgpt-web: 2 linhas, 1 com menção, ranks 1 e (null)
  {
    brandId: 'b1',
    platform: 'chatgpt-web',
    mentionCount: 3,
    citationCount: 1,
    appearanceRank: 1,
    sentiment: 'positive',
  },
  {
    brandId: 'b1',
    platform: 'chatgpt-web',
    mentionCount: 0,
    citationCount: 0,
    appearanceRank: null,
    sentiment: 'neutral',
  },
  // Polar / gemini-web: 2 linhas com menção, ranks 1 e 9 (média esconde extremo)
  {
    brandId: 'b1',
    platform: 'gemini-web',
    mentionCount: 1,
    citationCount: 0,
    appearanceRank: 1,
    sentiment: 'neutral',
  },
  {
    brandId: 'b1',
    platform: 'gemini-web',
    mentionCount: 2,
    citationCount: 2,
    appearanceRank: 9,
    sentiment: 'negative',
  },
  // Marca inativa: não pode aparecer no resumo
  {
    brandId: 'b2',
    platform: 'chatgpt-web',
    mentionCount: 5,
    citationCount: 5,
    appearanceRank: 1,
    sentiment: 'positive',
  },
];

describe('resolveConsistencyLlmModel', () => {
  it('prefers CONSISTENCY_LLM_MODEL over AUDIT_LLM_MODEL', () => {
    expect(
      resolveConsistencyLlmModel({
        CONSISTENCY_LLM_MODEL: 'anthropic/claude-x',
        AUDIT_LLM_MODEL: 'google/gemini-y',
      }),
    ).toBe('anthropic/claude-x');
  });

  it('falls back to AUDIT_LLM_MODEL', () => {
    expect(resolveConsistencyLlmModel({ AUDIT_LLM_MODEL: 'google/gemini-y' })).toBe(
      'google/gemini-y',
    );
  });

  it('returns null when neither env is set (feature off)', () => {
    expect(resolveConsistencyLlmModel({})).toBeNull();
  });
});

describe('summarizeBrandMetrics', () => {
  it('aggregates per active brand and per engine', () => {
    const summary = summarizeBrandMetrics(brands, results);
    // Só a Polar: a inativa é excluída, a sem dados também (nada a auditar).
    expect(summary).toHaveLength(1);
    const polar = summary[0];
    expect(polar.brand).toBe('Polar');
    expect(polar.totalResults).toBe(4);
    expect(polar.mentions).toBe(6);
    expect(polar.citations).toBe(3);
    expect(polar.presencePct).toBe(75); // 3 de 4 linhas com menção
    expect(polar.engines.map((e) => e.platform)).toEqual(['chatgpt-web', 'gemini-web']);
  });

  it('exposes rank extremes so the LLM can see an average hiding them', () => {
    const summary = summarizeBrandMetrics(brands, results);
    const gemini = summary[0].engines.find((e) => e.platform === 'gemini-web');
    expect(gemini.avgRank).toBe(5); // (1+9)/2
    expect(gemini.minRank).toBe(1);
    expect(gemini.maxRank).toBe(9);
  });

  it('counts sentiment only on rows WITH mention', () => {
    const summary = summarizeBrandMetrics(brands, results);
    const chatgpt = summary[0].engines.find((e) => e.platform === 'chatgpt-web');
    // A linha sem menção é 'neutral' mas NÃO conta (mesma regra do watchdog).
    expect(chatgpt.sentiment).toEqual({ positive: 1, neutral: 0, negative: 0 });
  });

  it('groups null platform under "(null)" instead of dropping rows', () => {
    const summary = summarizeBrandMetrics(
      [{ id: 'b1', name: 'X', isActive: true }],
      [
        {
          brandId: 'b1',
          platform: null,
          mentionCount: 1,
          citationCount: 0,
          appearanceRank: 1,
          sentiment: 'neutral',
        },
      ],
    );
    expect(summary[0].engines[0].platform).toBe('(null)');
  });
});

describe('findingsToAlerts', () => {
  it('maps critical/warn to the watchdog shape with the llm- prefix', () => {
    const alerts = findingsToAlerts([
      {
        severity: 'critical',
        code: 'avg-hides-extremes',
        message: 'Ranking médio 5 da Polar no Gemini esconde extremos 1 e 9.',
        evidence: 'avgRank=5, minRank=1, maxRank=9',
      },
      {
        severity: 'warn',
        code: 'engine-volume-outlier',
        message: 'Volume do Copilot destoa dos pares.',
        evidence: '',
      },
    ]);
    expect(alerts).toEqual([
      {
        key: 'llm-avg-hides-extremes',
        severity: 'critical',
        message:
          'Ranking médio 5 da Polar no Gemini esconde extremos 1 e 9. — evidência: avgRank=5, minRank=1, maxRank=9',
      },
      {
        key: 'llm-engine-volume-outlier',
        severity: 'warning',
        message: 'Volume do Copilot destoa dos pares.',
      },
    ]);
  });

  it('drops "info" findings (log-only, not an alert)', () => {
    const alerts = findingsToAlerts([
      { severity: 'info', code: 'nota', message: 'Só uma observação.', evidence: '' },
    ]);
    expect(alerts).toEqual([]);
  });

  it('slugifies messy codes and disambiguates duplicate keys', () => {
    const alerts = findingsToAlerts([
      { severity: 'warn', code: 'Média -- Extremo!', message: 'a', evidence: '' },
      { severity: 'warn', code: 'média  extremo', message: 'b', evidence: '' },
      { severity: 'warn', code: '', message: 'c', evidence: '' },
    ]);
    expect(alerts[0].key).toBe('llm-media-extremo');
    expect(alerts[1].key).toBe('llm-media-extremo-2');
    expect(alerts[2].key).toBe('llm-achado');
  });

  it('truncates runaway messages and evidence', () => {
    const alerts = findingsToAlerts([
      { severity: 'warn', code: 'longo', message: 'm'.repeat(1000), evidence: 'e'.repeat(1000) },
    ]);
    expect(alerts[0].message.length).toBeLessThanOrEqual(400 + ' — evidência: '.length + 300);
  });
});

describe('buildPrompt', () => {
  it('embeds the summary and the layer-1 findings as JSON', () => {
    const prompt = buildPrompt(
      [{ brand: 'Polar', totalResults: 4 }],
      [{ key: 'consistency-dup-competitors', severity: 'critical', message: 'dup' }],
    );
    expect(prompt).toContain('"brand":"Polar"');
    expect(prompt).toContain('consistency-dup-competitors');
    // Achados da camada 1 entram só como key+message (sem severidade — o LLM
    // não deve re-alertar, só cruzar).
    expect(prompt).not.toContain('"severity"');
  });
});

describe('weekly run cache + gating', () => {
  const savedConsistency = process.env.CONSISTENCY_LLM_MODEL;
  const savedAudit = process.env.AUDIT_LLM_MODEL;

  afterEach(() => {
    _resetLlmConsistencyCache();
    if (savedConsistency === undefined) delete process.env.CONSISTENCY_LLM_MODEL;
    else process.env.CONSISTENCY_LLM_MODEL = savedConsistency;
    if (savedAudit === undefined) delete process.env.AUDIT_LLM_MODEL;
    else process.env.AUDIT_LLM_MODEL = savedAudit;
  });

  it('exposes no alerts before any run', () => {
    _resetLlmConsistencyCache();
    expect(getLlmConsistencyAlerts()).toEqual([]);
  });

  it('runConsistencyLlmOnce is a no-op (empty, no throw) when no model env is set', async () => {
    delete process.env.CONSISTENCY_LLM_MODEL;
    delete process.env.AUDIT_LLM_MODEL;
    await expect(runConsistencyLlmOnce()).resolves.toEqual([]);
    expect(getLlmConsistencyAlerts()).toEqual([]);
  });

  it('default schedule is Monday 09:00 UTC (~3h after the Monday 06:00 census)', () => {
    expect(CONSISTENCY_LLM_DEFAULT_CRON).toBe('0 9 * * 1');
  });
});
