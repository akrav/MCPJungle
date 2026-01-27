import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { invokeTool } from '../../src/codemode/invoker';

describe('cancel propagation from invoker', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('sends cancel JSON-RPC on abort', async () => {
    const calls: any[] = [];
    (undici.fetch as any).mockImplementation(async (_url: any, init: any) => {
      calls.push(init);
      // First call hangs until aborted
      if (calls.length === 1) {
        return new Promise((_resolve, _reject) => {
          // never resolves; abort will trigger invoker to throw after we simulate
        }) as any;
      }
      // Second call is cancel
      return new undici.Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any;
    });

    const ac = new AbortController();
    const p = invokeTool('svc__slow', { n: 1 }, { cancelToken: ac.signal });
    // Trigger cancel and give the bridge a moment to send it
    ac.abort();
    await new Promise((r) => setTimeout(r, 10));
    void p.catch(() => {});

    // Ensure a cancel call was made
    const bodies = calls.map((c) => c.body as string);
    expect(bodies.some((b) => b && b.includes('"method":"cancel"'))).toBe(true);
  });
});


