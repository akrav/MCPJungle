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

describe('streaming aggregate to final result', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('aggregates JSON chunks and returns parsed result', async () => {
    const json = { jsonrpc: '2.0', id: 'x', result: { answer: 42 } };
    const text = JSON.stringify(json);
    const mid = Math.floor(text.length / 2);
    const stream = makeStream([text.slice(0, mid), text.slice(mid)]);

    (undici.fetch as any).mockResolvedValue(
      new undici.Response(stream as any, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }) as any,
    );

    const out = await invokeTool('svc__op', { a: 1 }, { runId: 'r-1' });
    expect(out).toEqual({ answer: 42 });
  });
});


