import { describe, it, expect, vi } from 'vitest';
import { invokeTool } from '../../src/codemode/invoker';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';

describe('retry/backoff & idempotency', () => {
  it('retries 502/503 with same id and one result', async () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    const bodies: string[] = [];
    (undici.fetch as any).mockImplementation(async (_url: string, init: any) => {
      bodies.push(String(init.body));
      if (bodies.length < 3) return new undici.Response('bad', { status: 502 }) as any;
      return new undici.Response(JSON.stringify({ jsonrpc: '2.0', id: 'x', result: { ok: true } }), { status: 200, headers: { 'content-type': 'application/json' } }) as any;
    });
    const out = await invokeTool('svc__op', {});
    expect(out).toEqual({ ok: true });
    expect(bodies.length).toBeGreaterThanOrEqual(3);
    const ids = bodies.map((b) => { try { return JSON.parse(b).id; } catch { return null; } });
    const first = ids[0];
    expect(ids.every((x) => x === first)).toBe(true);
  });
});


