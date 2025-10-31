import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as store from '../../src/routing/store';

describe('routing store TTL', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (store as any).clearAll?.();
    process.env.JUNGLE_URL = 'http://shared.example';
    delete process.env.ROUTING_USER_TTL_MS;
  });

  it('returns value before TTL and expires after', () => {
    const t0 = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    store.set('u', 'http://u.example', 1000);
    expect(store.get('u')).toBe('http://u.example');
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 1500);
    expect(store.get('u')).toBeUndefined();
  });
});


