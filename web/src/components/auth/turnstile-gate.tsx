'use client';

/**
 * Turnstile (Cloudflare) nas telas de autenticação.
 *
 * Por que existe: com login sem senha, a tela de login vira um alvo natural de
 * varredura — dá pra disparar milhares de e-mails e usar a resposta como
 * verificador de quem tem conta aqui. O formulário já responde igual pros dois
 * casos, mas isso só esconde o sinal; o Turnstile barra a tentativa em si, e é
 * o Supabase Auth quem valida o token do lado do servidor (Bot and Abuse
 * Protection), então não dá pra pular o desafio chamando a API direto.
 *
 * Desenho deliberado: **sem a env, tudo funciona como hoje.** Sem
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` o gate não renderiza nada e devolve
 * `captchaToken: undefined` — que é exatamente o que as chamadas mandam hoje.
 * Assim este código pode entrar em produção antes de existir chave, e ligar
 * depois é só preencher a env; nada some se a chave nunca chegar.
 *
 * O token é de uso único: quem chama precisa resetar depois de cada tentativa,
 * senão o segundo envio falha com um token já gasto.
 */

import { useRef, useState, useCallback } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export interface GateTurnstile {
  /** Passa em `options.captchaToken`; `undefined` quando o gate está desligado. */
  captchaToken: string | undefined;
  /** Chame depois de CADA tentativa — o token queima no primeiro uso. */
  reset: () => void;
  /** O widget em si (não renderiza nada quando não há chave). */
  widget: React.ReactNode;
}

export function useTurnstile(): GateTurnstile {
  const ref = useRef<TurnstileInstance | null>(null);
  const [token, setToken] = useState<string | undefined>(undefined);

  const reset = useCallback(() => {
    setToken(undefined);
    ref.current?.reset();
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return { captchaToken: undefined, reset: () => {}, widget: null };
  }

  return {
    captchaToken: token,
    reset,
    widget: (
      <div className="flex justify-center">
        <Turnstile
          ref={ref}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={setToken}
          // Token expirado ou desafio recusado tem que limpar o estado: manter
          // um token velho faria a próxima tentativa falhar sem explicação.
          onExpire={() => setToken(undefined)}
          onError={() => setToken(undefined)}
          options={{ size: 'flexible', theme: 'auto' }}
        />
      </div>
    ),
  };
}
