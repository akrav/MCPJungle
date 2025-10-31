#!/usr/bin/env -S node --enable-source-maps
/*
 Run a live Code Mode script against Jungle via the invoker bridge.
 Requirements:
 - JUNGLE_URL must point to your Jungle (e.g., http://localhost:9000 via compose)
 - Option A: Use real isolates → set CODEMODE_USE_STANDALONE=1 and ensure codemode-standalone builds
 - Option B: Use injected stub executor (default) → no native build required
 Usage:
   OTEL_TEST=true CODEMODE_TELEMETRY=true tsx scripts/codemode-live-run.ts [userId]
*/
import { __setStandaloneForTests, runCode } from '../src/codemode/runner.js';
import { invokeTool } from '../src/codemode/invoker.js';

const userId = process.argv[2] || process.env.LIVE_USER_ID || 'live-user-1';
const runId = `run-${Date.now().toString(16)}`;

// If using stubs (default), inject an IsolatedExecutor that evaluates code with a tools proxy
if (String(process.env.CODEMODE_USE_STANDALONE || '0') !== '1') {
  class SecurityPolicyManager { getMaxExecutionTime() { return 5_000; } }
  class IsolatedExecutor {
    constructor(private registry: any, _policy: any) {}
    async execute(code: string) {
      const toolsProxy = new Proxy({}, {
        get: (_t, prop: string) => async (args: unknown) => this.registry.executeTool(String(prop), args),
      });
      try {
        // Wrap code in a function scope with provided tools alias
        // runner will already prepend: const codemode = tools;\n
        // eslint-disable-next-line no-new-func
        const fn = new Function('tools', `'use strict'; ${code}`) as (tools: any) => any;
        const result = await Promise.resolve(fn(toolsProxy));
        return { success: true, result, executionTime: 1 };
      } catch (error) {
        return { success: false, error, executionTime: 0 };
      }
    }
  }
  __setStandaloneForTests({ SecurityPolicyManager, IsolatedExecutor });
}

// Example script: resolve library id then fetch docs via Context7
const code = `
  const id = await codemode["context7__resolve-library-id"]({ libraryName: "lodash" });
  const docs = await codemode["context7__get-library-docs"]({ context7CompatibleLibraryID: "/lodash/lodash", tokens: 2000 });
  return { id, docs };
`;

async function main() {
  if (!process.env.JUNGLE_URL) {
    console.error('Missing JUNGLE_URL environment variable');
    process.exit(2);
  }
  console.log(`[live] runId=${runId} userId=${userId} jungle=${process.env.JUNGLE_URL}`);
  const invoker = async (fn: string, args: unknown) => invokeTool(fn, args, { userId, runId });
  const out = await runCode({ code, invoker, runId, userId });
  if (out.result) {
    console.log(`[live] result ok; keys=${Object.keys(out.result as object).join(',')}`);
    console.log(JSON.stringify(out.result, null, 2));
  } else {
    console.error(`[live] diagnostics: ${(out.diagnostics && out.diagnostics.message) || 'unknown'}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


