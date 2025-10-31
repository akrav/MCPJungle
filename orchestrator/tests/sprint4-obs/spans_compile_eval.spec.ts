import { describe, it, expect, beforeEach } from 'vitest';
import { restartOtelForTests, getTestSpanExporter } from '../../src/obs/otel';
import { withRunSpan, withCompileSpan, withEvalSpan, withToolCallSpan } from '../../src/codemode/telemetry';

describe('spans for codemode compile/eval/tool', () => {
  beforeEach(async () => {
    process.env.OTEL_TEST = 'true';
    process.env.JUNGLE_URL = process.env.JUNGLE_URL || 'http://localhost:9000';
    process.env.CODEMODE_TELEMETRY = 'true';
    await restartOtelForTests();
  });

  it('emits spans with names and attributes', async () => {
    await withRunSpan({ run_id: 'r', user_id: 'u', catalog_hash: 'h' }, async () => {
      await withCompileSpan({ run_id: 'r' }, async () => {});
      await withEvalSpan({ run_id: 'r' }, async () => {});
      await withToolCallSpan('svc__op', { run_id: 'r', tool_name: 'svc__op' }, async () => {});
    });

    const exp = getTestSpanExporter();
    const names = exp?.getFinishedSpans().map((s) => s.name) || [];
    expect(names).toContain('codemode.run');
    expect(names).toContain('codemode.compile');
    expect(names).toContain('codemode.eval');
    expect(names).toContain('codemode.tool.svc__op');
  });
});


