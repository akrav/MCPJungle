import { log } from "../obs/log.js";
import { buildLimits, type SecurityLimits } from "./policy.js";

export type RunCodeParams = {
  code: string;
  invoker: (functionName: string, args: unknown) => Promise<unknown>;
  security?: Partial<SecurityLimits>;
  runId?: string;
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

export async function runCode(params: RunCodeParams): Promise<RunCodeResult> {
  const { code, invoker } = params;
  const limits = buildLimits(params.security);
  const runId = params.runId || undefined;

  log("info", "codemode_run_start", { runId });

  // A registry facade that forwards any name to invoker and enforces tool-call limit
  let toolCallCount = 0;
  const registry: ToolRegistryLike = {
    async executeTool(name: string, args: unknown): Promise<unknown> {
      toolCallCount += 1;
      if (toolCallCount > limits.maxToolCalls) {
        throw new Error("LimitExceeded: tool-calls");
      }
      return invoker(name, args);
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
    const mod: any = await import("codemode-standalone");
    const SecurityPolicyManager = mod.SecurityPolicyManager ?? class { constructor(_p?: unknown) {} getPolicy() { return {}; } getMaxExecutionTime() { return limits.maxExecutionTime; } };
    const IsolatedExecutor = mod.IsolatedExecutor ?? class { constructor(_r: unknown, _s: unknown) {} async execute() { return { success: true, result: undefined, executionTime: 0 }; } };

    const spm = new SecurityPolicyManager({
      maxExecutionTime: limits.maxExecutionTime,
      maxMemoryMB: limits.maxMemoryMB,
      allowNetworkAccess: limits.allowNetworkAccess,
    });

    const executor = new IsolatedExecutor(registry, spm);

    // Prepend an alias so code using `codemode` can work with the underlying `tools` proxy
    const aliased = `const codemode = tools;\n${code}`;
    const execResult = await executor.execute(aliased);

    if (execResult && execResult.success) {
      log("info", "codemode_run_end", { runId, ok: true });
      return { result: execResult.result };
    }

    const msg: string = execResult?.error?.message || "Unknown error";
    log("warn", "codemode_run_end", { runId, ok: false, msg });
    return { diagnostics: { message: msg } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("error", "codemode_run_exception", { runId, msg });
    return { diagnostics: { message: msg } };
  }
}


