import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { invokeTool } from '../../src/codemode/invoker';

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
      controller.close();
    },
  });
}

describe('correlation id propagation (runId) in logs', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('includes runId on start, chunk, and end logs', async () => {
    const json = { jsonrpc: '2.0', id: 'x', result: { ok: 1 } };
    const text = JSON.stringify(json);
    const stream = makeStream([text.slice(0, 5), text.slice(5)]);
    (undici.fetch as any).mockResolvedValue(
      new undici.Response(stream as any, { status: 200, headers: { 'content-type': 'application/json' } }) as any,
    );

    const logs: any[] = [];
    const clog = vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      try { logs.push(JSON.parse(String(msg))); } catch {}
    });

    const runId = 'run-xyz';
    await invokeTool('svc__op', {}, { runId });

    clog.mockRestore();
    const messages = logs.map((l) => l.msg);
    const runs = logs.map((l) => l.runId).filter(Boolean);
    expect(messages).toContain('codemode_bridge_start');
    expect(messages).toContain('codemode_bridge_chunk');
    expect(messages).toContain('codemode_bridge_end');
    expect(runs.every((r) => r === runId)).toBe(true);
  });
});


