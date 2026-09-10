import { after } from 'next/server';
import { API_BASE_URL } from '@/config/api';

/**
 * `prompt_results.citation_count` is frozen at tracking time. Domain or
 * alias changes must recount, or Citations vs stored tally diverge.
 */
export function scheduleCitationRecount(brandId: string) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;
  after(async () => {
    try {
      await fetch(`${API_BASE_URL}/api/internal/recount-citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ brandId }),
      });
    } catch (err) {
      console.error('[citation-recount] failed', err);
    }
  });
}
