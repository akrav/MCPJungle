import { describe, it, expect, vi } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { waitForHealthy } from '../../src/provisioning/health';

describe('health polling', () => {
  it('waits until healthy with backoff', async () => {
    const resBad = new undici.Response('{}', { status: 503 });
    const resOk = new undici.Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
    const spy = (undici.fetch as any).mockResolvedValueOnce(resBad as any).mockResolvedValueOnce(resOk as any);
    await waitForHealthy('http://localhost:9999', { timeoutMs: 2000, backoffMs: 10 });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});


