import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 5; } }
  class IsolatedExecutor { async execute() { return { success: false, error: { message: 'timed out' }, executionTime: 6 }; } }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('timeout limit', () => {
  it('returns diagnostics when code exceeds maxExecutionTime', async () => {
    const res = await runCode({ code: 'while(true){}', invoker: async () => ({}) });
    expect(res.diagnostics?.message).toMatch(/timed out/i);
  });
});


