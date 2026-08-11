import { describe, it, expect } from 'vitest';
import { evaluateChecks, formatAlertEmail } from './watchdog.js';

const NOW = new Date('2026-08-10T12:00:00Z');

const healthy = {
  failedJobs: [],
  stuckTasks: 0,
  recentResults: { total: 120, neutral: 40 },
  lastResultAt: '2026-08-10T06:00:00Z',
  orphanBrands: 0,
};

describe('watchdog evaluateChecks', () => {
  it('returns no alerts for a healthy snapshot', () => {
    expect(evaluateChecks(healthy, NOW)).toEqual([]);
  });

  it('flags failed jobs with deduped reasons', () => {
    const alerts = evaluateChecks(
      {
        ...healthy,
        failedJobs: [
          { type: 'tracking', failedReason: 'boom' },
          { type: 'tracking', failedReason: 'boom' },
          { type: 'content', failedReason: null },
        ],
      },
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('jobs-failed');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].message).toContain('3 job(s)');
    expect(alerts[0].message).toContain('boom');
    expect(alerts[0].message).toContain('sem motivo registrado');
  });

  it('flags a stuck Cloro queue', () => {
    const alerts = evaluateChecks({ ...healthy, stuckTasks: 12 }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('cloro-stuck');
  });

  it('flags 100% neutral sentiment over a real sample (the silent-401 case)', () => {
    const alerts = evaluateChecks({ ...healthy, recentResults: { total: 795, neutral: 795 } }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('sentiment-degraded');
    expect(alerts[0].message).toContain('OPENAI_API_KEY');
  });

  it('does NOT flag 100% neutral on a tiny sample', () => {
    const alerts = evaluateChecks({ ...healthy, recentResults: { total: 5, neutral: 5 } }, NOW);
    expect(alerts).toEqual([]);
  });

  it('flags tracking silence beyond the weekly cadence', () => {
    const alerts = evaluateChecks({ ...healthy, lastResultAt: '2026-07-30T00:00:00Z' }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('tracking-silent');
  });

  it('stays quiet when lastResultAt is unknown (fresh install)', () => {
    const alerts = evaluateChecks({ ...healthy, lastResultAt: null }, NOW);
    expect(alerts).toEqual([]);
  });

  it('flags active brands in orgs without any user (owner rule, 11/ago)', () => {
    const alerts = evaluateChecks({ ...healthy, orphanBrands: 2 }, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('orphan-brands');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].message).toContain('2 marca(s)');
  });

  it('tolerates snapshots without the orphanBrands field (older shape)', () => {
    const { orphanBrands: _omitted, ...older } = healthy;
    expect(evaluateChecks(older, NOW)).toEqual([]);
  });
});

describe('watchdog formatAlertEmail', () => {
  const NOW2 = new Date('2026-08-11T09:00:00Z');

  it('builds subject with critical count and lists every alert', () => {
    const { subject, text } = formatAlertEmail(
      [
        { key: 'jobs-failed', severity: 'critical', message: '2 job(s) falharam' },
        { key: 'cloro-stuck', severity: 'warning', message: '3 tarefa(s) pendentes' },
      ],
      NOW2,
    );
    expect(subject).toContain('2 alerta(s)');
    expect(subject).toContain('1 crítico(s)');
    expect(text).toContain('[CRITICAL] 2 job(s) falharam');
    expect(text).toContain('[WARNING] 3 tarefa(s) pendentes');
    expect(text).toContain('2026-08-11T09:00:00.000Z');
  });

  it('omits the critical suffix when there are only warnings', () => {
    const { subject } = formatAlertEmail(
      [{ key: 'tracking-silent', severity: 'warning', message: 'sem resultados' }],
      NOW2,
    );
    expect(subject).toContain('1 alerta(s)');
    expect(subject).not.toContain('crítico');
  });
});
