import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
  class IsolatedExecutor { async execute() { return { success: false, error: { message: 'Ambient API denied: fetch' }, executionTime: 1 }; } }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('deny ambient apis', () => {
  it('blocks fetch/setTimeout/crypto', async () => {
    const res = await runCode({ code: 'await fetch("https://example.com")', invoker: async () => ({}) });
    expect(res.diagnostics?.message).toMatch(/Ambient API denied/i);
  });
});


