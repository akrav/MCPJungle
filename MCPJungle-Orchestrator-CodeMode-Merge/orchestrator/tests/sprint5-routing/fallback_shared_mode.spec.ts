import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveJungleEndpoint } from '../../src/routing/router';

describe('fallback to shared when no mapping', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://shared.example';
    process.env.ROUTING_MODE = 'per_user';
  });

  it('logs warning and returns shared baseUrl', () => {
    const logs: any[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      try { logs.push(JSON.parse(String(msg))); } catch {}
    });
    const d = resolveJungleEndpoint({ userId: 'u-x' });
    expect(d.baseUrl).toBe('http://shared.example');
    const warn = logs.find((l) => l.msg === 'route_fallback_shared');
    expect(warn.user_id).toBe('u-x');
  });
});


