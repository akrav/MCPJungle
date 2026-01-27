import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restartOtelForTests, getTestSpanExporter, getTestMetrics } from '../../src/obs/otel';
import { runCode, __setStandaloneForTests } from '../../src/codemode/runner';

describe('E2E observability for a successful Code Mode run', () => {
  beforeEach(async () => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
    process.env.OTEL_TEST = 'true';
    process.env.CODEMODE_TELEMETRY = 'true';
    __setStandaloneForTests({
      SecurityPolicyManager: class { getMaxExecutionTime() { return 1000; } },
      IsolatedExecutor: class { constructor(private registry: any) {} async execute() { const a = await this.registry.executeTool('alpha__one', { a: 1 }); const b = await this.registry.executeTool('beta__two', { b: 2 }); return { success: true, result: { a, b }, executionTime: 2 }; } },
    });
    await restartOtelForTests();
  });

  it('emits spans, metrics, and logs coherently', async () => {
    const logs: any[] = [];
    const clog = vi.spyOn(console, 'log').mockImplementation((msg: any) => {
      try { logs.push(JSON.parse(String(msg))); } catch {}
    });
    const invoker = vi.fn(async (fn: string, args: unknown) => ({ fn, args }));
    const out = await runCode({ code: 'return 1', invoker, runId: 'run-1', userId: 'u', catalogHash: 'h' });
    clog.mockRestore();
    expect(out.result).toBeDefined();
    expect(invoker).toHaveBeenCalledTimes(2);

    const spans = getTestSpanExporter()?.getFinishedSpans() || [];
    const names = spans.map((s) => s.name);
    expect(names).toContain('codemode.run');
    expect(names).toContain('codemode.compile');
    expect(names).toContain('codemode.eval');
    expect(names).toContain('codemode.tool.alpha__one');
    expect(names).toContain('codemode.tool.beta__two');

    const m = getTestMetrics();
    expect(m.counters['tool_calls_total']).toBeGreaterThanOrEqual(2);
    expect(m.histograms['codemode_compile_ms']?.length).toBeGreaterThan(0);
    expect(m.histograms['codemode_eval_ms']?.length).toBeGreaterThan(0);

    const start = logs.find((l) => l.msg === 'codemode_run_start');
    const end = logs.find((l) => l.msg === 'codemode_run_end');
    expect(start.runId).toBe('run-1');
    expect(end.ok).toBe(true);
    expect(end.tool_calls).toBeGreaterThanOrEqual(2);
  });
});


