'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { BrandDomain } from '@/types';
import { scheduleCitationRecount } from '@/lib/citation-recount';

function mapDomainRow(d: Record<string, unknown>): BrandDomain {
  return {
    id: d.id as string,
    brandId: d.brand_id as string,
    domain: d.domain as string,
    country: (d.country as string | null) ?? undefined,
    isPrimary: d.is_primary as boolean,
  };
}

export async function addDomain(
  brandId: string,
  data: { domain: string; country?: string; isPrimary: boolean },
): Promise<BrandDomain> {
  const supabase = await createClient();

  const { data: domain, error } = await supabase
    .from('brand_domains')
    .insert({
      brand_id: brandId,
      domain: data.domain.trim(),
      country: data.country?.trim() || null,
      is_primary: data.isPrimary,
    })
    .select()
    .single();

  if (error || !domain) throw new Error(error?.message ?? 'Failed to add domain');

  scheduleCitationRecount(brandId);
  revalidatePath('/dashboard/brands');
  return mapDomainRow(domain as Record<string, unknown>);
}

export async function updateDomain(
  id: string,
  data: { domain?: string; country?: string | null; isPrimary?: boolean },
): Promise<BrandDomain> {
  const supabase = await createClient();

  const payload: Record<string, unknown> = {};
  if (data.domain !== undefined) payload.domain = data.domain.trim();
  if ('country' in data) payload.country = data.country?.trim() || null;
  if (data.isPrimary !== undefined) payload.is_primary = data.isPrimary;

  const { data: domain, error } = await supabase
    .from('brand_domains')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error || !domain) throw new Error(error?.message ?? 'Failed to update domain');

  // Only a change to the domain string itself affects citation counts.
  if (data.domain !== undefined) {
    scheduleCitationRecount((domain as Record<string, unknown>).brand_id as string);
  }
  revalidatePath('/dashboard/brands');
  return mapDomainRow(domain as Record<string, unknown>);
}

export async function removeDomain(id: string): Promise<void> {
  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from('brand_domains')
    .delete()
    .eq('id', id)
    .select('brand_id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (removed?.brand_id) scheduleCitationRecount(removed.brand_id as string);
  revalidatePath('/dashboard/brands');
}

/**
 * Replace all domains for a brand with the provided list.
 * Used by the DomainsTab save action.
 */
export async function syncDomains(
  brandId: string,
  domains: { domain: string; country?: string; isPrimary: boolean }[],
): Promise<BrandDomain[]> {
  const supabase = await createClient();

  await supabase.from('brand_domains').delete().eq('brand_id', brandId);

  if (domains.length === 0) {
    scheduleCitationRecount(brandId);
    revalidatePath('/dashboard/brands');
    return [];
  }

  const { data: inserted, error } = await supabase
    .from('brand_domains')
    .insert(
      domains.map((d) => ({
        brand_id: brandId,
        domain: d.domain.trim(),
        country: d.country?.trim() || null,
        is_primary: d.isPrimary,
      })),
    )
    .select();

  if (error) throw new Error(error.message);

  scheduleCitationRecount(brandId);
  revalidatePath('/dashboard/brands');
  return ((inserted as Record<string, unknown>[]) ?? []).map(mapDomainRow);
}
