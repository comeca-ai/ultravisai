import { describe, it, expect } from 'vitest';
import { summarizeUpstream } from './upstream-watch.js';

const NOW = new Date('2026-08-13T12:00:00Z');

describe('upstream watch summarizeUpstream', () => {
  it('counts only commits within the 3-day window', () => {
    const s = summarizeUpstream(
      {
        commits: [
          { date: '2026-08-13T09:00:00Z' },
          { date: '2026-08-11T09:00:00Z' },
          { date: '2026-08-01T09:00:00Z' },
          { date: null },
        ],
        siteChanged: false,
      },
      NOW,
    );
    expect(s.recentCommits).toBe(2);
    expect(s.hasNews).toBe(true);
  });

  it('flags news when only the site changed', () => {
    const s = summarizeUpstream({ commits: [], siteChanged: true }, NOW);
    expect(s.recentCommits).toBe(0);
    expect(s.hasNews).toBe(true);
  });

  it('reports quiet when nothing recent and site unchanged (or unknown)', () => {
    expect(summarizeUpstream({ commits: [{ date: '2026-07-01T00:00:00Z' }] }, NOW).hasNews).toBe(
      false,
    );
    expect(summarizeUpstream({}, NOW).hasNews).toBe(false);
  });
});
