import { describe, it, expect, vi } from 'vitest';
import { runCode } from '../../src/codemode/runner';

vi.mock('codemode-standalone', () => {
  class SecurityPolicyManager { getMaxExecutionTime() { return 1000; } }
  class IsolatedExecutor { async execute() { return { success: true, result: 42, executionTime: 1 }; } }
  return { SecurityPolicyManager, IsolatedExecutor };
});

describe('correlation id in logs', () => {
  it('includes runId in log lines', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const runId = 'test-run-123';
    await runCode({ code: 'return 42', invoker: async () => ({}), runId });
    const payloads = spy.mock.calls.map((c) => {
      try { return JSON.parse(String(c[0])); } catch { return {}; }
    });
    expect(payloads.some((p) => p.runId === runId)).toBe(true);
    spy.mockRestore();
  });
});


