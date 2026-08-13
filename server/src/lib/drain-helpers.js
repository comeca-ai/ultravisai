/**
 * Ultravis addition (fork layer): pure drain-loop helpers, ported from the
 * upstream reliability fixes (#649/#690/#710/#716) and adapted to our
 * webhook-mode drain in workers/tracking-worker.js. They live in their own
 * module (no supabase import) so unit tests can load them without env.
 */

/**
 * True when every still-pending task was submitted longer ago than `maxAgeMs`.
 *
 * Such tasks can no longer be in flight: Cloro accepted them and never called
 * back (google-aio does this whenever a query has no AI Overview). Combined
 * with "no new result for a while", this is what separates a ghost tail from
 * a normal quiet gap mid-burst, where fresh tasks are still outstanding.
 *
 * Deliberately false for an empty list — no pending tasks is a completed
 * drain, handled by the caller before this is consulted. (upstream #690)
 */
export function allTasksAreStale(rows, maxAgeMs, now = Date.now()) {
  if (!rows || rows.length === 0) return false;
  const cutoff = now - maxAgeMs;
  return rows.every((r) => r.submitted_at && new Date(r.submitted_at).getTime() < cutoff);
}

/**
 * Which drain time budget, if any, has run out. (upstream #710)
 *
 * Two budgets rather than one cap measured from submission. Before anything
 * has come back there is nothing to reason about — the stall and ghost exits
 * both compare successive pending counts — so that phase gets its own, longer
 * allowance. Once delivery starts, the tail is measured from the first result,
 * so a slow queue start no longer consumes the time the tail needs.
 *
 * Returns 'no_first_result', 'tail_deadline', or null while within budget.
 */
export function drainBudgetExceeded({
  now,
  drainStartedAt,
  firstResultAt,
  firstResultWaitMs,
  drainTailMs,
}) {
  if (firstResultAt === null || firstResultAt === undefined) {
    return now - drainStartedAt >= firstResultWaitMs ? 'no_first_result' : null;
  }
  return now - firstResultAt >= drainTailMs ? 'tail_deadline' : null;
}

/**
 * PostgREST silently caps an un-paginated select at 1000 rows, so reading a
 * brand's pending tasks in one request under-reports any run that submitted
 * more than that. Page through instead. (upstream #716)
 *
 * `fetchPage(offset)` resolves to `{ data, error }` exactly as a PostgREST
 * range query does. A partial read is worse than no read — on error the whole
 * poll is surfaced for retry.
 */
export const PENDING_PAGE_SIZE = 1000;

export async function fetchAllPendingRows(fetchPage, pageSize = PENDING_PAGE_SIZE) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(offset);
    if (error) return { rows: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, error: null };
  }
}
