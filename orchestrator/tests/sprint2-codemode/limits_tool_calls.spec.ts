import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
  class IsolatedExecutor {
    constructor(private registry: any) {}
    async execute(): Promise<any> {
      // simulate more calls than allowed
      for (let i = 0; i < 55; i++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.registry.executeTool('echo__one', { i });
        } catch (e) {
          return { success: false, error: { message: (e as Error).message }, executionTime: 1 };
        }
      }
      return { success: true, result: { ok: true }, executionTime: 1 };
    }
  }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('tool call limits', () => {
  it('enforces maxToolCalls and returns diagnostics', async () => {
    const invoker = vi.fn(async () => ({ ok: true }));
    const res = await runCode({ code: 'return 1', invoker, security: { maxToolCalls: 50 } });
    expect(res.diagnostics?.message).toMatch(/LimitExceeded: tool-calls/);
  });
});


