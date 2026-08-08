import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

/**
 * Ultravis addition (fork layer). Server-side guard for every admin route:
 * hiding the menu item isn't enough — a client typing /dashboard/admin/costs
 * must not reach it. Gated by operator e-mail (see @/lib/admin), not org role.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
