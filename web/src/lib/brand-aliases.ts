/** Apelidos da marca (migration 00036). Usado em menção e, desde #189, em citação. */

const MAX_ALIASES = 20;

export function suggestedBrandAlias(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  return first.length >= 2 ? first : null;
}

export function normalizeBrandAliases(raw: string[], officialName: string): string[] {
  const official = officialName.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (key === official) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= MAX_ALIASES) break;
  }
  return out;
}

export function aliasesChanged(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return true;
  const a = before.map((s) => s.toLowerCase()).sort();
  const b = after.map((s) => s.toLowerCase()).sort();
  return a.some((v, i) => v !== b[i]);
}
