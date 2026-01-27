import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_p?: unknown) {}
    getPolicy() { return {}; }
    getMaxExecutionTime() { return 1000; }
  }
  class IsolatedExecutor {
    // registry, spm stored for potential future tests
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_registry: unknown, _spm: unknown) {}
    async execute(): Promise<any> {
      return { success: true, result: { ok: true }, executionTime: 1 };
    }
  }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('runner result envelope', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns {result} on success and maps diagnostics on error', async () => {
    const invoker = vi.fn(async () => ({ ok: true }));
    const success = await runCode({ code: 'return 1', invoker });
    expect(success).toEqual({ result: { ok: true } });

    // flip mock to fail
    vi.doMock('codemode-standalone', () => {
      class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
      class IsolatedExecutor { async execute() { return { success: false, error: { message: 'boom' }, executionTime: 1 }; } }
      return { SecurityPolicyManager, IsolatedExecutor };
    });

    const { runCode: runCodeReloaded } = await import('../../src/codemode/runner');
    const failure = await runCodeReloaded({ code: 'throw', invoker });
    expect(failure).toEqual({ diagnostics: { message: 'boom' } });
  });
});


