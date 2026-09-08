import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn() },
}));

import dns from 'node:dns/promises';
import { ipEhPrivado, validarUrlExterna } from './ssrf-guard.js';

describe('ipEhPrivado', () => {
  it('bloqueia loopback, privado, link-local e o endpoint de metadata de nuvem', () => {
    expect(ipEhPrivado('127.0.0.1')).toBe(true);
    expect(ipEhPrivado('10.0.0.5')).toBe(true);
    expect(ipEhPrivado('172.16.0.1')).toBe(true);
    expect(ipEhPrivado('192.168.1.1')).toBe(true);
    expect(ipEhPrivado('169.254.169.254')).toBe(true); // metadata AWS/GCP/Cloudflare
    expect(ipEhPrivado('100.64.0.1')).toBe(true); // CGNAT — faixa de container
    expect(ipEhPrivado('::1')).toBe(true);
    expect(ipEhPrivado('fe80::1')).toBe(true);
    expect(ipEhPrivado('fd00::1')).toBe(true);
    expect(ipEhPrivado('::ffff:127.0.0.1')).toBe(true); // IPv4-mapped
  });

  it('deixa passar IP público de verdade', () => {
    expect(ipEhPrivado('8.8.8.8')).toBe(false);
    expect(ipEhPrivado('1.1.1.1')).toBe(false);
    expect(ipEhPrivado('2606:4700:4700::1111')).toBe(false);
  });

  it('não confunde vizinho de faixa privada com privado', () => {
    expect(ipEhPrivado('11.0.0.1')).toBe(false); // fora de 10.0.0.0/8
    expect(ipEhPrivado('192.169.0.1')).toBe(false); // fora de 192.168.0.0/16
  });
});

describe('validarUrlExterna', () => {
  beforeEach(() => {
    vi.mocked(dns.lookup).mockReset();
  });

  it('aceita URL http(s) que resolve pra IP público', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const url = await validarUrlExterna('https://example.com/hook');
    expect(url.hostname).toBe('example.com');
  });

  it('rejeita protocolo que não é http/https', async () => {
    await expect(validarUrlExterna('file:///etc/passwd')).rejects.toMatchObject({ status: 400 });
    await expect(validarUrlExterna('ftp://example.com')).rejects.toMatchObject({ status: 400 });
  });

  it('rejeita URL malformada sem estourar', async () => {
    await expect(validarUrlExterna('não é url')).rejects.toMatchObject({ status: 400 });
    await expect(validarUrlExterna('')).rejects.toMatchObject({ status: 400 });
  });

  it('rejeita quando o host resolve pra IP privado (localhost, 127.0.0.1)', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(validarUrlExterna('http://localhost:8080/')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejeita quando UM dos endereços resolvidos é privado (round-robin DNS)', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);
    await expect(validarUrlExterna('http://exemplo-round-robin.test/')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejeita quando a resolução DNS falha, sem vazar o motivo', async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error('ENOTFOUND detalhe-interno-de-rede'));
    const erro = await validarUrlExterna('http://naoexiste.invalid/').catch((e) => e);
    expect(erro.status).toBe(400);
    expect(erro.message).not.toContain('detalhe-interno-de-rede');
  });
});
