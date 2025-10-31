import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
  class IsolatedExecutor { async execute() { return { success: false, error: { message: 'LimitExceeded: memory' }, executionTime: 1 }; } }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('memory limit', () => {
  it('returns diagnostics when memory cap exceeded', async () => {
    const res = await runCode({ code: 'new Array(1e9).fill(0)', invoker: async () => ({}) });
    expect(res.diagnostics?.message).toMatch(/LimitExceeded: memory/);
  });
});


