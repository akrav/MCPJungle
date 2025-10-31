import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi } from 'vitest';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';
import { postToJungle } from '../../src/server/upstream';

describe('header hygiene for invoker/upstream', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:12345';
    vi.restoreAllMocks();
  });

  it('sets UA, Forwarded, Accept/Content-Type and optional Authorization', async () => {
    process.env.JUNGLE_TOKEN = 'tkn';
    const spy = (undici.fetch as any).mockResolvedValue(
      new undici.Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as any,
    );

    await postToJungle({ jsonrpc: '2.0', id: 1, method: 'noop' }, { userId: 'u' });
    const [, init] = (spy as any).mock.calls[0] as [string, any];
    const h = init.headers as Record<string, string>;
    expect(h['User-Agent']).toContain('orchestrator/1.0');
    expect(h['Forwarded']).toBe('proto=http');
    expect(h['Content-Type']).toBe('application/json');
    expect(h['Accept']).toContain('application/json');
    expect(h['Authorization']).toBe('Bearer tkn');
  });
});


