'use server';

/**
 * Ultravis addition (fork layer — additive action, no core changes).
 *
 * Usage aggregates for the admin cost-monitoring page
 * (/dashboard/admin/costs). Counts real consumption events stored in the
 * database — tracking results (Cloro scrapes vs Claude-API calls), sentiment
 * runs, site audits, agent tokens — scoped by RLS to the caller's org.
 * Cost math (unit prices, token estimates) lives in the page, clearly
 * labeled as estimates; this action only returns measured facts.
 */

import { createClient } from '@/lib/supabase/server';

export interface UsageByKey {
  key: string;
  count: number;
}

export interface AdminUsage {
  totalResults: number;
  /** Results whose platform is the Anthropic API tracker. */
  claudeApiResults: number;
  /** Total characters of Claude-API responses (token estimation input). */
  claudeApiChars: number;
  /** Results from Cloro scrapes (everything that isn't the Claude tracker). */
  cloroScrapes: number;
  sentimentRuns: number;
  /** Average response length across sentiment-analyzed results. */
  avgSentimentChars: number;
  siteAudits: number;
  agentPromptTokens: number;
  agentCompletionTokens: number;
  activePrompts: number;
  brands: number;
  byPlatform: UsageByKey[];
  byBrand: UsageByKey[];
  byDay: UsageByKey[];
  firstResultAt: string | null;
  lastResultAt: string | null;
}

interface ResultRow {
  platform: string | null;
  brand_id: string;
  created_at: string;
  sentiment: string | null;
  response: string | null;
}

export async function getAdminUsage(): Promise<AdminUsage> {
  const supabase = await createClient();

  const [resultsRes, brandsRes, promptsRes, auditsRes, agentRes] = await Promise.all([
    supabase
      .from('prompt_results')
      .select('platform, brand_id, created_at, sentiment, response')
      .neq('platform', 'chatgpt-shopping'),
    supabase.from('brands').select('id, name'),
    supabase.from('prompts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('site_audits').select('id', { count: 'exact', head: true }),
    supabase.from('agent_token_usage').select('prompt_tokens, completion_tokens'),
  ]);

  const rows = (resultsRes.data ?? []) as ResultRow[];
  const brandNames = new Map(
    ((brandsRes.data ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]),
  );

  const byPlatform = new Map<string, number>();
  const byBrand = new Map<string, number>();
  const byDay = new Map<string, number>();
  let claudeApiResults = 0;
  let claudeApiChars = 0;
  let sentimentRuns = 0;
  let sentimentChars = 0;
  let firstResultAt: string | null = null;
  let lastResultAt: string | null = null;

  for (const row of rows) {
    const platform = row.platform ?? 'unknown';
    byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + 1);
    const brand = brandNames.get(row.brand_id) ?? '—';
    byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (platform === 'claude') {
      claudeApiResults += 1;
      claudeApiChars += row.response?.length ?? 0;
    }
    if (row.sentiment !== null) {
      sentimentRuns += 1;
      sentimentChars += row.response?.length ?? 0;
    }
    if (firstResultAt === null || row.created_at < firstResultAt) firstResultAt = row.created_at;
    if (lastResultAt === null || row.created_at > lastResultAt) lastResultAt = row.created_at;
  }

  const agentRows = (agentRes.data ?? []) as { prompt_tokens: number; completion_tokens: number }[];

  const toSorted = (m: Map<string, number>, byKey = false): UsageByKey[] =>
    [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => (byKey ? a.key.localeCompare(b.key) : b.count - a.count));

  return {
    totalResults: rows.length,
    claudeApiResults,
    claudeApiChars,
    cloroScrapes: rows.length - claudeApiResults,
    sentimentRuns,
    avgSentimentChars: sentimentRuns > 0 ? Math.round(sentimentChars / sentimentRuns) : 0,
    siteAudits: auditsRes.count ?? 0,
    agentPromptTokens: agentRows.reduce((s, r) => s + (r.prompt_tokens ?? 0), 0),
    agentCompletionTokens: agentRows.reduce((s, r) => s + (r.completion_tokens ?? 0), 0),
    activePrompts: promptsRes.count ?? 0,
    brands: brandNames.size,
    byPlatform: toSorted(byPlatform),
    byBrand: toSorted(byBrand),
    byDay: toSorted(byDay, true),
    firstResultAt,
    lastResultAt,
  };
}
