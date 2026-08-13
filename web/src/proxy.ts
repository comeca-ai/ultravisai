import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

const protectedPathnames = ['/dashboard'];
const authPathnames = ['/sign-in', '/sign-up'];

function isProtected(pathname: string): boolean {
  return protectedPathnames.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthRoute(pathname: string): boolean {
  return authPathnames.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const pathnameWithoutLocale = pathname.replace(/^\/(en|pt-BR)(?=\/|$)/, '') || '/';

  let supabaseResponse: NextResponse | undefined;
  let user: { id: string } | null = null;

  try {
    const session = await updateSession(request);
    supabaseResponse = session.supabaseResponse;
    user = session.user;
  } catch {
    // Supabase session refresh failed — continue without auth context
    // so next-intl locale routing still works
  }

  // `/` is the public landing page. Signed-in users skip it and go straight
  // to the dashboard; anonymous visitors fall through and get the landing.
  if (pathnameWithoutLocale === '/' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Ultravis: pricing lives on our own landing's #pricing section. (This
  // used to send users to the UPSTREAM site ansvisor.com — brand leak.)
  if (pathnameWithoutLocale === '/pricing') {
    return NextResponse.redirect(new URL('/#pricing', request.url), 302);
  }

  if (isProtected(pathnameWithoutLocale) && !user) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute(pathnameWithoutLocale) && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Workaround for a Next.js framework issue (vercel/next.js#91723): RSC
  // prefetch/navigation requests and server-action POSTs that go through
  // next-intl's middleware intermittently die server-side with "The router
  // state header was sent but could not be parsed" — and the client then
  // holds its whole server-action queue behind the failed transition, which
  // froze the Prompts page. For these requests the intl middleware only does
  // the locale rewrite, so do that by hand and skip the intl machinery
  // entirely: paths already carrying a locale prefix pass through, and
  // unprefixed paths get the default locale (pt-BR, per routing.ts —
  // 'as-needed' means the default locale is the unprefixed one).
  const isRscOrAction = request.headers.has('rsc') || request.headers.has('next-action');
  if (isRscOrAction) {
    const hasLocalePrefix = routing.locales.some(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    );
    const response = !hasLocalePrefix
      ? NextResponse.rewrite(
          new URL(`/${routing.defaultLocale}${pathname}${request.nextUrl.search}`, request.url),
          { request },
        )
      : NextResponse.next({ request });
    if (supabaseResponse) {
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie);
      });
    }
    return response;
  }

  const intlResponse = intlMiddleware(request);

  if (supabaseResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
