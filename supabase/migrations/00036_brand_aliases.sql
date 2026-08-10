-- Ultravis addition (fork layer): brand recognition aliases.
--
-- A brand's registered name is often the corporate one ("Polar Electro")
-- while AI answers use the colloquial one ("Polar"). Mention matching is
-- exact-text, so such brands read as never mentioned — 0 visibility, 0 share
-- of voice and sentiment skipped ("Brand not mentioned"). Aliases are extra
-- names counted as brand mentions during tracking (and backfills).
-- Real case: Polar Electro, 10/ago/2026 — 184 results, 0 mentions.

alter table public.brands
  add column if not exists aliases text[] not null default '{}';

comment on column public.brands.aliases is
  'Extra names counted as brand mentions during tracking (e.g. "Polar" for "Polar Electro").';
