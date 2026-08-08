/**
 * Ultravis addition (fork layer). Platform-operator gate for admin-only
 * surfaces (e.g. the Costs & Usage page).
 *
 * This is intentionally NOT the org-level `user_role` ('admin' | 'manager' |
 * ...): an org admin is admin of THEIR OWN organization (a client), not of
 * the platform. Platform-operator surfaces must never be visible to clients,
 * so we gate by an operator e-mail allowlist instead.
 *
 * Configure via `NEXT_PUBLIC_ADMIN_EMAILS` (comma-separated). The fallback
 * keeps the operator's own access working out of the box; override the env
 * to change it without a code change.
 */

const FALLBACK_ADMIN_EMAILS = ['jhonata.emerick@gmail.com', 'jer@ultravis.ai'];

export function adminEmails(): string[] {
  const configured = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const list = configured ? configured.split(',') : FALLBACK_ADMIN_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
