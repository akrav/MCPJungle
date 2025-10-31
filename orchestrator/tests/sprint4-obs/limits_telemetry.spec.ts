import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restartOtelForTests, getTestSpanExporter, getTestMetrics } from '../../src/obs/otel';
import { runCode, __setStandaloneForTests } from '../../src/codemode/runner';

describe('limit enforcement telemetry', () => {
  beforeEach(async () => {
    process.env.JUNGLE_URL = 'http://localhost:9000';
    process.env.OTEL_TEST = 'true';
    process.env.CODEMODE_TELEMETRY = 'true';
    __setStandaloneForTests({
      SecurityPolicyManager: class { getMaxExecutionTime() { return 100; } },
      IsolatedExecutor: class { constructor(private registry: any) {} async execute() { try { await this.registry.executeTool('alpha__one', {}); await this.registry.executeTool('beta__two', {}); } catch (e) { return { success: false, error: e, executionTime: 1 }; } return { success: true, result: {}, executionTime: 1 }; } },
    });
    await restartOtelForTests();
  });

  it('records limit_exceeded counter and span event', async () => {
    const out = await runCode({ code: 'return 1', invoker: async () => ({}), security: { maxToolCalls: 1 }, runId: 'r' });
    expect(out.diagnostics?.message || '').toContain('LimitExceeded');

    const metrics = getTestMetrics();
    expect(metrics.counters['codemode_errors_total.limit_exceeded']).toBe(1);
    const spans = getTestSpanExporter()?.getFinishedSpans() || [];
    const limit = spans.find((s) => s.name === 'codemode.limit');
    expect(limit?.attrs?.limit).toBe('maxToolCalls');
    expect(limit?.attrs?.run_id).toBe('r');
  });
});


