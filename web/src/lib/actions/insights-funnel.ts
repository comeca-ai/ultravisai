'use server';

/**
 * Funil da citação (Insights v3, mockup do dono 19/ago) — extensão ADITIVA:
 * arquivo próprio pra não tocar em tracking.ts (regra anti-drift do fork).
 *
 * As quatro etapas saem de dados que o rastreamento JÁ coleta:
 *   1. execuções     = respostas na janela (mesmos filtros do resto da tela);
 *   2. grounded      = respostas cujo `citations` (todas as fontes que a IA
 *                      listou, não só as da marca) não é vazio;
 *   3. mercado citado = grounded cujas fontes batem em domínio da marca OU de
 *                      concorrente acompanhado (o "gabarito de mercado");
 *   4. marca citada  = respostas com `citation_count > 0` (match da marca,
 *                      já computado pelo server na coleta).
 *
 * O match do mercado (etapa 3) roda aqui em JS sobre as fontes — evita
 * migration/RPC nova (não há acesso pra aplicar no banco nesta fase) e o
 * volume é limitado: só `citation_count` + `citations` são selecionados,
 * paginado, com teto documentado.
 */

import { createClient } from '@/lib/supabase/server';
import { expandDateToEndOfDay } from '@/lib/dates';
import { extractHostname } from '@/lib/citations/classify';
import type { FunnelCounts } from '@/app/[locale]/(dashboard)/dashboard/insights/insights-v3-logic';

const PAGE_SIZE = 1000;
/** Teto de linhas analisadas por chamada — janela típica fica bem abaixo. */
const MAX_ROWS = 6000;

interface FunnelFilterOpts {
  model?: string;
  region?: string;
  topicId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface FunnelRow {
  citation_count: number;
  citations: Array<{ url?: string }> | null;
}

/** Hostname sem www, ou null — tolerante a domínio salvo sem esquema. */
function hostOf(value: string | undefined | null): string | null {
  if (!value) return null;
  const host = extractHostname(value.includes('://') ? value : `https://${value}`);
  return host ? host.replace(/^www\./, '') : null;
}

export async function getCitationFunnel(
  brandId: string,
  opts?: FunnelFilterOpts,
): Promise<FunnelCounts> {
  const supabase = await createClient();

  // Gabarito de mercado: domínios dos concorrentes acompanhados. (O match da
  // PRÓPRIA marca já vem pronto em citation_count, alias incluídos.)
  const { data: competitors } = await supabase
    .from('competitors')
    .select('domain')
    .eq('brand_id', brandId);
  const marketHosts = new Set(
    ((competitors ?? []) as { domain: string | null }[])
      .map((c) => hostOf(c.domain))
      .filter((h): h is string => Boolean(h)),
  );

  // Tópico resolve UMA vez, fora do builder — o builder precisa ser síncrono:
  // o query builder do supabase-js é thenable, e devolvê-lo de função async
  // faria o await executar a query antes do .range().
  let topicPromptIds: string[] | null = null;
  if (opts?.topicId) {
    const { data: topicPrompts } = await supabase
      .from('prompts')
      .select('id')
      .eq('topic_id', opts.topicId);
    topicPromptIds = ((topicPrompts ?? []) as { id: string }[]).map((p) => p.id);
  }

  // Mesmos filtros de buildResultsQuery (tracking.ts), reproduzidos aqui por
  // ser módulo-privado lá: brand + sem chatgpt-shopping + model/region/data/tópico.
  const buildQuery = () => {
    let query = supabase
      .from('prompt_results')
      .select('citation_count, citations')
      .eq('brand_id', brandId)
      .neq('platform', 'chatgpt-shopping');
    if (opts?.model) {
      const list = opts.model
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      query = list.length > 1 ? query.in('model_used', list) : query.eq('model_used', list[0]);
    }
    if (opts?.region) query = query.eq('region', opts.region);
    if (opts?.dateFrom) query = query.gte('created_at', opts.dateFrom);
    const dateTo = expandDateToEndOfDay(opts?.dateTo);
    if (dateTo) query = query.lte('created_at', dateTo);
    if (topicPromptIds) {
      query = query.in(
        'prompt_id',
        topicPromptIds.length > 0 ? topicPromptIds : ['00000000-0000-0000-0000-000000000000'],
      );
    }
    return query;
  };

  const counts: FunnelCounts = { executions: 0, grounded: 0, marketCited: 0, brandCited: 0 };

  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`citation funnel query failed: ${error.message}`);
    const rows = (data ?? []) as FunnelRow[];

    for (const row of rows) {
      counts.executions += 1;
      const sources = Array.isArray(row.citations) ? row.citations : [];
      const isGrounded = sources.length > 0;
      if (isGrounded) counts.grounded += 1;
      const citesBrand = row.citation_count > 0;
      if (citesBrand) counts.brandCited += 1;
      if (isGrounded) {
        const citesMarket =
          citesBrand ||
          sources.some((s) => {
            const host = hostOf(s?.url);
            return host !== null && marketHosts.has(host);
          });
        if (citesMarket) counts.marketCited += 1;
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return counts;
}
