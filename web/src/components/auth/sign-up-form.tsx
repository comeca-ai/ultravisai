'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { Separator } from '@/components/ui/separator';
import { siteConfig } from '@/config/site';
import { track } from '@/lib/analytics';

export function SignUpForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitedEmail = searchParams.get('email') ?? '';
  const nextPath = searchParams.get('next');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error(t('errors.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      const alreadyExists = /already (registered|exists)|user exists/i.test(error.message);
      toast.error(alreadyExists ? t('errors.accountExists') : t('errors.generic'));
      setIsLoading(false);
      return;
    }

    // With email confirmation on, Supabase answers an existing confirmed email
    // with a fake success (anti-enumeration) whose user has no identities —
    // without this check the user is told "verification email sent" and waits
    // for an email that never comes (pilot-client feedback #27).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      toast.error(t('errors.accountExists'));
      setIsLoading(false);
      return;
    }

    track('signup_completed', { source: 'email' });

    toast.success(t('verificationEmailSent'));
    const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : '';
    router.push(`/sign-in?verified=pending${nextQuery}`);
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{t('fullName')}</Label>
          <Input
            id="fullName"
            type="text"
            placeholder={t('fullNamePlaceholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            disabled={isLoading}
          />
        </div>

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
            disabled={isLoading || Boolean(invitedEmail)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput
            id="password"
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('signingUp')}
            </>
          ) : (
            t('createAccount')
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {t('termsAgreement')}{' '}
          <Link
            href={siteConfig.legal.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-primary"
          >
            {t('termsOfService')}
          </Link>{' '}
          {t('and')}{' '}
          <Link
            href={siteConfig.legal.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-primary"
          >
            {t('privacyPolicy')}
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
