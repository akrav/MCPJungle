import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { invokeTool } from '../../src/codemode/invoker';

describe('error mapping parity with relay', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('non-JSON upstream maps to -32000 with status', async () => {
    (undici.fetch as any).mockResolvedValue(
      new undici.Response('<html>bad</html>', { status: 502, headers: { 'content-type': 'text/html' } }) as any,
    );
    await expect(invokeTool('svc__bad', {})).rejects.toMatchObject({ code: -32000, status: 502 });
  });

  it('JSON-RPC error passes through as thrown error with code', async () => {
    const obj = { jsonrpc: '2.0', id: 'x', error: { code: -32001, message: 'oops' } };
    const text = JSON.stringify(obj);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text));
        c.close();
      },
    });
    (undici.fetch as any).mockResolvedValue(
      new undici.Response(stream as any, { status: 200, headers: { 'content-type': 'application/json' } }) as any,
    );
    await expect(invokeTool('svc__err', {})).rejects.toMatchObject({ message: 'oops', code: -32001 });
  });
});


