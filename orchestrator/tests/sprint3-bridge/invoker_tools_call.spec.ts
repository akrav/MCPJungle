import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as upstream from '../../src/server/upstream';
import { invokeTool } from '../../src/codemode/invoker';
import * as undici from 'undici';

describe('codemode invoker tools/call', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('composes JSON-RPC and returns result content', async () => {
    const res = new undici.Response(
      JSON.stringify({ jsonrpc: '2.0', id: 'x', result: { ok: true } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
    const spy = vi.spyOn(upstream, 'postToJungle').mockResolvedValue(res as any);

    const out = await invokeTool('alpha__one', { x: 1 }, { userId: 'u1', runId: 'r1' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [body] = spy.mock.calls[0] as [any, any];
    expect(body.method).toBe('tools/call');
    expect(body.params.name).toBe('alpha__one');
    expect(body.params.arguments).toEqual({ x: 1 });
    expect(out).toEqual({ ok: true });
  });
});


