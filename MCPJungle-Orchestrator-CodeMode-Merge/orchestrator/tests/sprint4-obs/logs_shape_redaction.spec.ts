import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCode, __setStandaloneForTests } from '../../src/codemode/runner';

describe('logs shape and redaction', () => {
  beforeEach(() => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
    process.env.CODEMODE_TELEMETRY = 'true';
    process.env.CODEMODE_PERSIST_CODE = 'false';
    __setStandaloneForTests({
      SecurityPolicyManager: class { getMaxExecutionTime() { return 1000; } },
      IsolatedExecutor: class { constructor(private _r: any, private _s: any) {} async execute() { return { success: true, result: 123, executionTime: 1 }; } },
    });
  });

  it('includes run fields and code_hash only', async () => {
    const logs: any[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      try { logs.push(JSON.parse(String(msg))); } catch {}
    });

    const code = 'return 42';
    const res = await runCode({ code, invoker: async () => ({}), runId: 'r-id', userId: 'u-id', catalogHash: 'h-id' });
    expect(res.result).toBe(123);
    spy.mockRestore();

    const start = logs.find((l) => l.msg === 'codemode_run_start');
    const end = logs.find((l) => l.msg === 'codemode_run_end');
    expect(start.runId).toBe('r-id');
    expect(start.user_id).toBe('u-id');
    expect(start.catalog_hash).toBe('h-id');
    expect(typeof start.code_hash).toBe('string');
    // code content must not be present
    const asText = JSON.stringify(logs);
    expect(asText.includes(code)).toBe(false);
    expect(end.tool_calls).toBeDefined();
    expect(end.duration_ms).toBeGreaterThanOrEqual(0);
  });
});


