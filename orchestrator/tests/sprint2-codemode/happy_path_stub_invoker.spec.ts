import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
  class IsolatedExecutor {
    constructor(private registry: any) {}
    async execute() {
      // two sequential tool calls
      const a = await this.registry.executeTool('alpha__one', { x: 1 });
      const b = await this.registry.executeTool('beta__two', { y: 2 });
      return { success: true, result: { a, b }, executionTime: 1 };
    }
  }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('happy path with stub invoker', () => {
  it('invokes invoker twice and composes results', async () => {
    const invoker = vi.fn(async (fn: string, args: unknown) => ({ fn, args }));
    const res = await runCode({ code: 'return 1', invoker });
    expect(invoker).toHaveBeenCalledTimes(2);
    expect(res.result).toEqual({ a: { fn: 'alpha__one', args: { x: 1 } }, b: { fn: 'beta__two', args: { y: 2 } } });
  });
});


