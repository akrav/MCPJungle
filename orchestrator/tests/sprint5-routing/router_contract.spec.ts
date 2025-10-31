import { describe, it, expect, beforeEach } from 'vitest';
import { resolveJungleEndpoint } from '../../src/routing/router';

describe('router contract', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://shared.example';
    process.env.ROUTING_MODE = 'shared';
  });

  it('returns shared when mode=shared', () => {
    const d = resolveJungleEndpoint({ userId: 'u1' });
    expect(d).toEqual({ baseUrl: 'http://shared.example', mode: 'shared' });
  });

  it('returns shared when no userId', () => {
    process.env.ROUTING_MODE = 'per_user';
    const d = resolveJungleEndpoint({});
    expect(d.mode).toBe('shared');
  });
});


