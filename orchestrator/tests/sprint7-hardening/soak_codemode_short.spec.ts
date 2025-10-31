import { describe, it, expect, vi } from 'vitest';
import { runCode, __setStandaloneForTests } from '../../src/codemode/runner';

describe('soak: many short Code Mode runs (stub)', () => {
  it('achieves high success rate with low p95', async () => {
    process.env.JUNGLE_URL = 'http://shared.example';
    __setStandaloneForTests({
      SecurityPolicyManager: class {},
      IsolatedExecutor: class { constructor(private reg: any) {} async execute() { await this.reg.executeTool('a__t',{}); await this.reg.executeTool('b__t',{}); return { success: true, result: 1, executionTime: 1 }; }},
    });
    const invoker = vi.fn(async () => ({}));
    const N = 50; const K = 5; // total, concurrency
    const durs: number[] = []; let ok = 0;
    let i = 0;
    async function worker() {
      while (i < N) {
        const idx = i++; const t0 = Date.now();
        const out = await runCode({ code: 'return 1', invoker });
        const dt = Date.now() - t0; durs.push(dt);
        if (out.result !== undefined) ok++;
      }
    }
    await Promise.all(Array.from({ length: K }, () => worker()));
    durs.sort((a,b)=>a-b);
    const p95 = durs[Math.floor(0.95*durs.length)-1] || 0;
    expect(ok / N).toBeGreaterThanOrEqual(0.99);
    expect(p95).toBeLessThanOrEqual(50);
  });
});


