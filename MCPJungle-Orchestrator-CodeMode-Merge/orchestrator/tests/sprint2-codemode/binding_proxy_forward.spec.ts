import { describe, it, expect, vi } from 'vitest';
import { createCodemodeBinding } from '../../src/codemode/binding';

describe('codemode binding proxy', () => {
  it('forwards name and args to invoker', async () => {
    const invoker = vi.fn(async (_fn: string, _args: unknown) => ({ ok: true }));
    const codemode = createCodemodeBinding(invoker);

    const res = await codemode['weather__forecast']({ city: 'SF' });
    expect(invoker).toHaveBeenCalledWith('weather__forecast', { city: 'SF' });
    expect(res).toEqual({ ok: true });
  });

  it('rejects non-string properties', async () => {
    const invoker = vi.fn(async () => ({}));
    const codemode = createCodemodeBinding(invoker);
    expect(() => (codemode as any)[Symbol.for('x')]).toThrow(/Invalid codemode property/);
  });
});


