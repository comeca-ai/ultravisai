import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gatewayBaseURL, gatewayHeaders } from './ai-gateway.js';

const saved = {};
const KEYS = ['AI_GATEWAY_ACCOUNT_ID', 'AI_GATEWAY_NAME', 'AI_GATEWAY_TOKEN'];

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('ai-gateway', () => {
  it('sem AI_GATEWAY_ACCOUNT_ID, tudo segue direto (undefined)', () => {
    expect(gatewayBaseURL('openai')).toBeUndefined();
    expect(gatewayHeaders()).toBeUndefined();
  });

  it('com account id, monta a URL do gateway com o nome default "ultravis"', () => {
    process.env.AI_GATEWAY_ACCOUNT_ID = 'acc123';
    expect(gatewayBaseURL('anthropic')).toBe(
      'https://gateway.ai.cloudflare.com/v1/acc123/ultravis/anthropic',
    );
    expect(gatewayBaseURL('google-ai-studio/v1beta')).toBe(
      'https://gateway.ai.cloudflare.com/v1/acc123/ultravis/google-ai-studio/v1beta',
    );
  });

  it('AI_GATEWAY_NAME sobrescreve o nome do gateway', () => {
    process.env.AI_GATEWAY_ACCOUNT_ID = 'acc123';
    process.env.AI_GATEWAY_NAME = 'staging';
    expect(gatewayBaseURL('openai')).toBe(
      'https://gateway.ai.cloudflare.com/v1/acc123/staging/openai',
    );
  });

  it('header cf-aig-authorization só quando gateway E token existem', () => {
    process.env.AI_GATEWAY_TOKEN = 'tok';
    expect(gatewayHeaders()).toBeUndefined(); // token sem gateway não roteia
    process.env.AI_GATEWAY_ACCOUNT_ID = 'acc123';
    expect(gatewayHeaders()).toEqual({ 'cf-aig-authorization': 'Bearer tok' });
  });
});
