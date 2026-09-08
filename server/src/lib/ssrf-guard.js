/**
 * Guarda contra SSRF pra qualquer fetch de URL fornecida por quem chama a API
 * (webhook de teste, auditoria de site). Sem isto, um usuário autenticado de
 * QUALQUER organização consegue fazer o servidor requisitar host interno
 * (loopback, rede privada do container, endpoint de metadata de nuvem) e ler
 * a resposta — achado da auditoria de 08/set, camada 'aplicacao'.
 *
 * Resolve o hostname e valida o IP resultante antes do fetch — bloquear só
 * pelo texto do host (ex. "localhost") não pega quem passa o IP direto, nem
 * DNS rebinding básico (nome público que resolve pra IP privado).
 */

import dns from 'node:dns/promises';
import net from 'node:net';

/** Blocos que nunca devem ser alcançados a partir de um fetch server-side. */
const BLOQUEADOS_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT — inclui o intervalo que a Cloudflare usa pra containers
  '127.0.0.0/8',
  '169.254.0.0/16', // link-local — inclui endpoint de metadata de nuvem (169.254.169.254)
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reservado
];

function ipParaInteiro(ip) {
  return ip.split('.').reduce((acc, octeto) => acc * 256 + Number(octeto), 0);
}

function dentroDoBloco(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipParaInteiro(ip) & mascara) === (ipParaInteiro(base) & mascara);
}

/** true se o IP (v4 ou v6) é privado/loopback/link-local/reservado. */
export function ipEhPrivado(ip) {
  if (net.isIPv4(ip)) {
    return BLOQUEADOS_V4.some((bloco) => dentroDoBloco(ip, bloco));
  }
  if (net.isIPv6(ip)) {
    const normalizado = ip.toLowerCase();
    if (normalizado === '::1') return true; // loopback
    if (normalizado.startsWith('fe80:')) return true; // link-local
    if (normalizado.startsWith('fc') || normalizado.startsWith('fd')) return true; // unique local
    if (normalizado.startsWith('::ffff:')) {
      // IPv4-mapped — valida a parte v4.
      const v4 = normalizado.split(':').pop();
      return net.isIPv4(v4) && BLOQUEADOS_V4.some((bloco) => dentroDoBloco(v4, bloco));
    }
  }
  return false;
}

/**
 * Valida uma URL fornecida por quem chama a API antes de qualquer fetch.
 * Lança com `.status = 400` (mensagem segura, sem detalhe de rede interna)
 * quando a URL não deve ser alcançada.
 *
 * @param {string} rawUrl
 * @returns {Promise<URL>} a URL parseada, pronta pra usar no fetch
 */
export async function validarUrlExterna(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch {
    throw Object.assign(new Error('URL inválida'), { status: 400 });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('URL inválida'), { status: 400 });
  }

  let enderecos;
  try {
    enderecos = await dns.lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw Object.assign(new Error('Não foi possível resolver o host'), { status: 400 });
  }
  if (enderecos.length === 0 || enderecos.some((e) => ipEhPrivado(e.address))) {
    throw Object.assign(new Error('URL inválida'), { status: 400 });
  }

  return url;
}
