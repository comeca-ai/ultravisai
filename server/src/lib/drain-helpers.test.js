import { describe, it, expect } from 'vitest';
import {
  allTasksAreStale,
  drainBudgetExceeded,
  fetchAllPendingRows,
} from '../lib/drain-helpers.js';

const NOW = Date.parse('2026-08-13T12:00:00Z');
const MIN = 60_000;

describe('allTasksAreStale (ghost detection, upstream #690)', () => {
  it('is true when every pending task is older than the threshold', () => {
    const rows = [
      { submitted_at: new Date(NOW - 45 * MIN).toISOString() },
      { submitted_at: new Date(NOW - 31 * MIN).toISOString() },
    ];
    expect(allTasksAreStale(rows, 30 * MIN, NOW)).toBe(true);
  });

  it('is false while any task is still fresh enough to be in flight', () => {
    const rows = [
      { submitted_at: new Date(NOW - 45 * MIN).toISOString() },
      { submitted_at: new Date(NOW - 5 * MIN).toISOString() },
    ];
    expect(allTasksAreStale(rows, 30 * MIN, NOW)).toBe(false);
  });

  it('is deliberately false for an empty list (a drained queue is not a ghost)', () => {
    expect(allTasksAreStale([], 30 * MIN, NOW)).toBe(false);
    expect(allTasksAreStale(null, 30 * MIN, NOW)).toBe(false);
  });
});

describe('drainBudgetExceeded (two budgets, upstream #710)', () => {
  const budgets = { firstResultWaitMs: 90 * MIN, drainTailMs: 60 * MIN };

  it('waits out the first-result allowance before giving up', () => {
    expect(
      drainBudgetExceeded({
        now: NOW + 89 * MIN,
        drainStartedAt: NOW,
        firstResultAt: null,
        ...budgets,
      }),
    ).toBeNull();
    expect(
      drainBudgetExceeded({
        now: NOW + 90 * MIN,
        drainStartedAt: NOW,
        firstResultAt: null,
        ...budgets,
      }),
    ).toBe('no_first_result');
  });

  it('measures the tail from the first result, not from submission', () => {
    // 62 min after submission, but only 2 min after the first delivery.
    expect(
      drainBudgetExceeded({
        now: NOW + 62 * MIN,
        drainStartedAt: NOW,
        firstResultAt: NOW + 60 * MIN,
        ...budgets,
      }),
    ).toBeNull();
    expect(
      drainBudgetExceeded({
        now: NOW + 121 * MIN,
        drainStartedAt: NOW,
        firstResultAt: NOW + 60 * MIN,
        ...budgets,
      }),
    ).toBe('tail_deadline');
  });
});

describe('fetchAllPendingRows (paged reads, upstream #716)', () => {
  it('follows pages until a short page and concatenates rows', async () => {
    const pages = [
      Array.from({ length: 3 }, (_, i) => ({ task_id: `a${i}` })),
      [{ task_id: 'b0' }],
    ];
    const calls = [];
    const { rows, error } = await fetchAllPendingRows((offset) => {
      calls.push(offset);
      return Promise.resolve({ data: pages[offset / 3] ?? [], error: null });
    }, 3);
    expect(error).toBeNull();
    expect(rows).toHaveLength(4);
    expect(calls).toEqual([0, 3]);
  });

  it('surfaces a page error instead of returning a partial read', async () => {
    const { rows, error } = await fetchAllPendingRows(
      (offset) =>
        offset === 0
          ? Promise.resolve({ data: Array.from({ length: 3 }, (_, i) => ({ task_id: i })) })
          : Promise.resolve({ data: null, error: new Error('boom') }),
      3,
    );
    expect(rows).toBeNull();
    expect(error).toBeInstanceOf(Error);
  });
});
