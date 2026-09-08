'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, MailCheck } from 'lucide-react';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Separator } from '@/components/ui/separator';
import { track } from '@/lib/analytics';
import { useTurnstile } from '@/components/auth/turnstile-gate';

/** Janela do rate limit do Supabase para reenvio de OTP. */
const ESPERA_REENVIO_S = 60;

export function SignInForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  // The middleware sends users here with ?redirectTo=<original path>; older
  // links use ?next. Honor both so a post-login user lands where they were
  // headed instead of silently falling back to /dashboard (#29 friction).
  const nextPath = searchParams.get('next') ?? searchParams.get('redirectTo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Login sem senha: o mesmo formulário troca de modo em vez de virar outra
  // página — o e-mail já digitado não se perde na troca.
  const [semSenha, setSemSenha] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [esperaReenvio, setEsperaReenvio] = useState(0);
  // Desligado enquanto não houver NEXT_PUBLIC_TURNSTILE_SITE_KEY — aí o token
  // vai como undefined, que é o que as chamadas já mandam hoje.
  const turnstile = useTurnstile();

  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const id = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [esperaReenvio]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstile.captchaToken },
    });
    // Token é de uso único: sem resetar, a segunda tentativa morre com um
    // token já gasto e a pessoa não entende por quê.
    turnstile.reset();

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        toast.error(t('errors.emailNotConfirmed'));
      } else if (msg.includes('invalid login credentials')) {
        toast.error(t('errors.invalidCredentials'));
      } else {
        toast.error(t('errors.generic'));
      }
      setIsLoading(false);
      return;
    }

    // identify() runs centrally in AuthProvider on the SIGNED_IN auth event,
    // so the form just needs to capture the funnel event.
    track('signin_completed', { source: 'email' });

    router.push(nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard');
    router.refresh();
  }

  /** Pede o link. Separado do submit pra o botão de reenvio chamar o mesmo código. */
  async function pedirLink() {
    setIsLoading(true);

    const supabase = createClient();
    const destino = nextPath && nextPath.startsWith('/') ? nextPath : '/dashboard';

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Sem isto, pedir o link viraria um cadastro silencioso: qualquer e-mail
        // digitado errado criaria conta nova, fora do fluxo de cadastro e sem
        // aceite de termos. Entrar é entrar; criar conta é criar conta.
        shouldCreateUser: false,
        // /auth/callback já troca o code por sessão e respeita ?next — o mesmo
        // caminho do OAuth, então nada de novo pra manter.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destino)}`,
        captchaToken: turnstile.captchaToken,
      },
    });
    turnstile.reset();

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate') || msg.includes('security purposes') || msg.includes('too many')) {
        toast.error(t('errors.rateLimited'));
        setIsLoading(false);
        return;
      }
      // Qualquer outro erro aqui é, na prática, "esse e-mail não tem conta"
      // (com shouldCreateUser:false o Supabase recusa o envio). Mostrar isso na
      // tela transformaria o login num verificador de quem é cliente nosso:
      // bastaria testar e-mails até um deles não dar erro. Então a tela diz o
      // mesmo nos dois casos, e quem não tem conta simplesmente não recebe nada.
      track('signin_magiclink_requested', { known: false });
      setLinkEnviado(true);
      setEsperaReenvio(ESPERA_REENVIO_S);
      setIsLoading(false);
      return;
    }

    track('signin_magiclink_requested', { known: true });
    setLinkEnviado(true);
    setEsperaReenvio(ESPERA_REENVIO_S);
    setIsLoading(false);
  }

  if (linkEnviado) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('magicLinkSent')}</p>
            <p className="text-sm text-muted-foreground">{t('magicLinkSentTo', { email })}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={esperaReenvio > 0 || isLoading}
            onClick={() => void pedirLink()}
          >
            {esperaReenvio > 0
              ? t('magicLinkResendIn', { seconds: esperaReenvio })
              : t('magicLinkResend')}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setLinkEnviado(false);
              setEsperaReenvio(0);
            }}
          >
            {t('magicLinkOtherEmail')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OAuthButtons />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
        </div>
      </div>

      <form
        onSubmit={
          semSenha
            ? (e) => {
                e.preventDefault();
                void pedirLink();
              }
            : handleSubmit
        }
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
          />
        </div>

        {semSenha ? null : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('password')}</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
              >
                {t('forgotPassword')}
              </Link>
            </div>
            <PasswordInput
              id="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
        )}

        {turnstile.widget}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {semSenha ? t('sendingMagicLink') : t('signingIn')}
            </>
          ) : semSenha ? (
            t('magicLink')
          ) : (
            t('signIn')
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setSemSenha((v) => !v)}
        disabled={isLoading}
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline disabled:opacity-50"
      >
        {semSenha ? t('usePassword') : t('useMagicLink')}
      </button>
    </div>
  );
}
