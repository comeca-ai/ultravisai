import { describe, it, expect } from 'vitest';
import { normalizeWebsiteUrl } from './brands.js';

describe('normalizeWebsiteUrl', () => {
  it('adds protocol and trailing slash to a bare domain', () => {
    expect(normalizeWebsiteUrl('datarisk.io')).toBe('https://datarisk.io/');
  });

  it('keeps the typed path (Polar Brasil case: /br is its own storefront)', () => {
    expect(normalizeWebsiteUrl('www.polar.com/br')).toBe('https://www.polar.com/br');
    expect(normalizeWebsiteUrl('https://www.polar.com/br/')).toBe('https://www.polar.com/br');
  });

  it('drops query string and hash', () => {
    expect(normalizeWebsiteUrl('https://acme.com/about?utm=x#team')).toBe('https://acme.com/about');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeWebsiteUrl('')).toBeNull();
    expect(normalizeWebsiteUrl('   ')).toBeNull();
  });
});
