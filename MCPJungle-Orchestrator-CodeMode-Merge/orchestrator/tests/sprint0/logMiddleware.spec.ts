import { describe, it, expect, vi } from 'vitest';
import { log } from '../../src/obs/log';

describe('logger redaction', () => {
  it('redacts tokens and auth headers', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      log('info', 'test', {
        Authorization: 'Bearer secret',
        refresh_token: 'abc',
        nested: { apiKey: 'k' },
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const arg = spy.mock.calls[0][0] as string;
      const obj = JSON.parse(arg);
      expect(obj.Authorization).toBe('[REDACTED]');
      expect(obj.refresh_token).toBe('[REDACTED]');
      expect(obj.nested.apiKey).toBe('[REDACTED]');
    } finally {
      spy.mockRestore();
    }
  });
});
