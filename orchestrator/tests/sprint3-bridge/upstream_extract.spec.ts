import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { postToJungle, getUpstreamSession, setUpstreamSession } from '../../src/server/upstream';

describe('upstream helper extract', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    delete process.env.JUNGLE_TOKEN;
    setUpstreamSession(null);
    vi.restoreAllMocks();
  });

  it('sets required headers and updates session from reflection', async () => {
    const spy = (undici.fetch as any).mockResolvedValue(
      new undici.Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'mcp-session-id': 'sess1' },
      }) as any,
    );

    await postToJungle({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { userId: 'user-1', useSession: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const [, init] = spy.mock.calls[0] as [string, any];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toContain('application/json');
    expect(headers['User-Agent']).toContain('orchestrator');
    expect(headers['Forwarded']).toBe('proto=http');
    expect(headers['x-user-id']).toBe('user-1');
    expect(getUpstreamSession()).toBe('sess1');
  });

  it('retries on 503 then succeeds', async () => {
    const r1 = new undici.Response('svc down', { status: 503, headers: { 'content-type': 'text/plain' } });
    const r2 = new undici.Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const spy = (undici.fetch as any)
      .mockResolvedValueOnce(r1 as any)
      .mockResolvedValueOnce(r2 as any);

    const res = await postToJungle({ jsonrpc: '2.0', id: 2, method: 'noop' }, { userId: 'u', useSession: false });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });
});


