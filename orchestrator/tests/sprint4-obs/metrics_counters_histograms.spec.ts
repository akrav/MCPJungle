import { describe, it, expect, beforeEach } from 'vitest';
import { restartOtelForTests, getTestMetrics } from '../../src/obs/otel';
import { recordCompileMs, recordEvalMs, incToolCalls, incErrors } from '../../src/codemode/telemetry';

describe('metrics for compile/eval and counters', () => {
  beforeEach(async () => {
    process.env.OTEL_TEST = 'true';
    process.env.JUNGLE_URL = process.env.JUNGLE_URL || 'http://localhost:9000';
    process.env.CODEMODE_TELEMETRY = 'true';
    await restartOtelForTests();
  });

  it('records histograms and increments counters', async () => {
    recordCompileMs(12);
    recordEvalMs(34);
    incToolCalls(2);
    incErrors('compile');

    const m = getTestMetrics();
    expect(m.histograms['codemode_compile_ms']?.length).toBeGreaterThan(0);
    expect(m.histograms['codemode_eval_ms']?.length).toBeGreaterThan(0);
    expect(m.counters['tool_calls_total']).toBeGreaterThanOrEqual(2);
    expect(m.counters['codemode_errors_total.compile']).toBe(1);
  });
});


