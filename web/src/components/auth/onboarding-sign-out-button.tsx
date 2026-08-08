'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function OnboardingSignOutButton() {
  const tAuth = useTranslations('auth');
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsSigningOut(false);
      toast.error(tAuth('errors.signOutError'));
      return;
    }

    // Sair leva de volta à landing pública (não à tela de login); o proxy
    // serve a landing em `/` para visitantes anônimos.
    window.location.href = '/';
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" />
      {tAuth('signOut')}
    </button>
  );
}
