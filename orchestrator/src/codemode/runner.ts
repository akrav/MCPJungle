import { log } from "../obs/log.js";
import { buildLimits, type SecurityLimits } from "./policy.js";
import { computeCodeHash, incErrors, incToolCalls, maybePersistCode, recordCompileMs, recordEvalMs, recordLimitEvent, withCompileSpan, withEvalSpan, withRunSpan, withToolCallSpan } from "./telemetry.js";
import { loadConfig } from "../config/load.js";
import { initTrace, trace } from "./trace.js";

export type RunCodeParams = {
  code: string;
  invoker: (functionName: string, args: unknown) => Promise<unknown>;
  security?: Partial<SecurityLimits>;
  runId?: string;
  userId?: string;
  catalogHash?: string;
};

export type RunCodeResult = {
  result?: unknown;
  diagnostics?: { message: string };
};

type ToolRegistryLike = {
  executeTool(name: string, args: unknown): Promise<unknown>;
  hasTool(name: string): boolean;
  getToolNames(): string[];
};

let InjectedIsolatedExecutor: any | undefined;
let InjectedSecurityPolicyManager: any | undefined;

export function __setStandaloneForTests(mocks: { IsolatedExecutor?: any; SecurityPolicyManager?: any }) {
  InjectedIsolatedExecutor = mocks.IsolatedExecutor;
  InjectedSecurityPolicyManager = mocks.SecurityPolicyManager;
}

export async function runCode(params: RunCodeParams): Promise<RunCodeResult> {
  const { code, invoker } = params;
  const limits = buildLimits(params.security);
  const runId = params.runId || undefined;
  const userId = params.userId;
  const catalogHash = params.catalogHash;
  const cfg = loadConfig(process.env);
  const codeHash = computeCodeHash(code);

  log("info", "codemode_run_start", { runId, user_id: userId, code_hash: codeHash, catalog_hash: catalogHash });
  await initTrace(runId || "", { user_id: userId, catalog_hash: catalogHash });
  if (cfg.codemodePersistCode && runId) {
    const preview = code.trim().replace(/\s+/g, ' ').slice(0, 200);
    if (cfg.codemodeVerboseLogs) log("debug", "codemode_script_preview", { runId, preview_len: preview.length, preview });
    await trace(runId || "", "script_preview", { preview_len: preview.length });
  }
  if (cfg.codemodePersistCode && runId) maybePersistCode(runId, code);

  // A registry facade that forwards any name to invoker and enforces tool-call limit
  let toolCallCount = 0;
  const registry: ToolRegistryLike = {
    async executeTool(name: string, args: unknown): Promise<unknown> {
      toolCallCount += 1;
      if (toolCallCount > limits.maxToolCalls) {
        incErrors('limit_exceeded');
        recordLimitEvent('maxToolCalls', { run_id: runId, user_id: userId, catalog_hash: catalogHash });
        throw new Error("LimitExceeded: tool-calls");
      }
      incToolCalls(1);
      return withToolCallSpan(name, { run_id: runId, user_id: userId, catalog_hash: catalogHash, tool_name: name }, async () => invoker(name, args));
    },
    hasTool(_name: string): boolean {
      return true;
    },
    getToolNames(): string[] {
      return [];
    },
  };

  try {
    // Dynamically import codemode-standalone to avoid hard build-time dependency
    let SecurityPolicyManager: any = InjectedSecurityPolicyManager;
    let IsolatedExecutor: any = InjectedIsolatedExecutor;
    if (!SecurityPolicyManager || !IsolatedExecutor) {
      if (String(process.env.CODEMODE_USE_STANDALONE || '0') === '1') {
        const lib = 'codemode' + '-standalone';
        const mod: any = await import(lib as string);
        SecurityPolicyManager = mod.SecurityPolicyManager;
        IsolatedExecutor = mod.IsolatedExecutor;
      } else {
        // Minimal stub for tests/dev without standalone available
        SecurityPolicyManager = class { constructor(_p?: unknown) {} getPolicy() { return {}; } getMaxExecutionTime() { return limits.maxExecutionTime; } };
        IsolatedExecutor = class { constructor(_r: unknown, _s: unknown) {} async execute() { return { success: true, result: undefined, executionTime: 0 }; } };
      }
    }

    const spm = new SecurityPolicyManager({
      maxExecutionTime: limits.maxExecutionTime,
      maxMemoryMB: limits.maxMemoryMB,
      allowNetworkAccess: limits.allowNetworkAccess,
    });

    const executor = new IsolatedExecutor(registry, spm);

    // Prepend an alias so code using `codemode` can work with the underlying `tools` proxy
    const aliased = `const codemode = tools;\n${code}`;
    const t0 = Date.now();
    const execResult = await withRunSpan({ run_id: runId, user_id: userId, catalog_hash: catalogHash }, async () => {
      if (cfg.codemodeVerboseLogs) log("debug", "codemode_compile_start", { runId });
      await trace(runId || "", "compile_start");
      const compiled = await withCompileSpan({ run_id: runId, user_id: userId, catalog_hash: catalogHash }, async () => aliased);
      recordCompileMs(Date.now() - t0);
      const t1 = Date.now();
      if (cfg.codemodeVerboseLogs) log("debug", "codemode_eval_start", { runId });
      await trace(runId || "", "eval_start");
      const out = await withEvalSpan({ run_id: runId, user_id: userId, catalog_hash: catalogHash }, async () => executor.execute(compiled));
      recordEvalMs(Date.now() - t1);
      return out;
    });

    if (execResult && execResult.success) {
      log("info", "codemode_run_end", { runId, ok: true, tool_calls: toolCallCount, duration_ms: Date.now() - t0 });
      return { result: execResult.result };
    }

    const msg: string = execResult?.error?.message || "Unknown error";
    incErrors('eval');
    log("warn", "codemode_run_end", { runId, ok: false, msg, tool_calls: toolCallCount, duration_ms: Date.now() - t0 });
    return { diagnostics: { message: msg } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    incErrors('eval');
    log("error", "codemode_run_exception", { runId, msg });
    return { diagnostics: { message: msg } };
  }
}


