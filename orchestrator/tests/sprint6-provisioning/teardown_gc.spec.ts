import { describe, it, expect, vi } from 'vitest';
import * as store from '../../src/routing/store';

async function gcStaleEntries(provisioner: { stop: (u: string) => Promise<void> }) {
  const expired = store.listExpired(Date.now());
  for (const e of expired) {
    await provisioner.stop(e.userId);
  }
}

describe('teardown GC', () => {
  it('stops stale instances', async () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    store.clearAll();
    const t0 = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    store.set('u1', 'http://a', 1);
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 2000);
    const prov = { stop: vi.fn(async () => {}) };
    await gcStaleEntries(prov);
    expect(prov.stop).toHaveBeenCalledWith('u1');
  });
});


