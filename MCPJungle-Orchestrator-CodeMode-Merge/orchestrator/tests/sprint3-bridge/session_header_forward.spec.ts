import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { postToJungle, setUpstreamSession } from '../../src/server/upstream';

describe('session header forward and reflection', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    setUpstreamSession(null);
    vi.restoreAllMocks();
  });

  it('captures session from first response and forwards on second request', async () => {
    const calls: any[] = [];
    (undici.fetch as any).mockImplementation(async (url: any, init: any) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return new undici.Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json', 'mcp-session-id': 'S-123' },
        }) as any;
      }
      return new undici.Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any;
    });

    await postToJungle({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { userId: 'u1', useSession: true });
    await postToJungle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { userId: 'u1', useSession: true });

    expect(calls.length).toBe(2);
    const headers2 = calls[1].init.headers as Record<string, string>;
    expect(headers2['Mcp-Session-Id']).toBe('S-123');
  });
});


