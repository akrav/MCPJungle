import { describe, it, expect, vi } from 'vitest';
import { invokeTool } from '../../src/codemode/invoker';
vi.mock('undici', async () => {
  const actual = await vi.importActual<any>('undici');
  return { ...actual, fetch: vi.fn() };
});
import * as undici from 'undici';

describe('chaos: restart jungle mid-run', () => {
  it('maps error deterministically', async () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    (undici.fetch as any).mockResolvedValue(
      new undici.Response('<html>bad</html>', { status: 502, headers: { 'content-type': 'text/html' } }) as any,
    );
    await expect(invokeTool('svc__op', {}, { userId: 'u' })).rejects.toMatchObject({ code: -32000 });
  });
});


