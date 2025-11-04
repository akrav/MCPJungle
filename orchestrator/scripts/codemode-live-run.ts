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
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const userId = process.argv[2] || process.env.LIVE_USER_ID || 'live-user-1';
const runId = `run-${Date.now().toString(16)}`;
const logDir = process.env.CODEMODE_LOG_DIR || '';
const outPrefix = process.env.CODEMODE_OUT_PREFIX || `${userId}_${runId}`;

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
        // Create an async function so top-level await in user code is valid
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor as new (...args: string[]) => (...args: any[]) => Promise<any>;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const fn = new AsyncFunction('tools', `'use strict'; ${code}`) as (tools: any) => Promise<any>;
        const result = await fn(toolsProxy);
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
  if (logDir) {
    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.writeFile(path.join(logDir, `05_${outPrefix}_codemode_script.js`), code, 'utf8');
    } catch {}
  }
  const invoker = async (fn: string, args: unknown) => invokeTool(fn, args, { userId, runId });
  const out = await runCode({ code, invoker, runId, userId });
  if (out.result) {
    console.log(`[live] result ok; keys=${Object.keys(out.result as object).join(',')}`);
    const json = JSON.stringify(out.result, null, 2);
    console.log(json);
    if (logDir) {
      try { await fs.writeFile(path.join(logDir, `05_${outPrefix}_codemode_result.json`), json, 'utf8'); } catch {}
    }
  } else {
    console.error(`[live] diagnostics: ${(out.diagnostics && out.diagnostics.message) || 'unknown'}`);
    if (logDir) {
      try { await fs.writeFile(path.join(logDir, `05_${outPrefix}_codemode_result.json`), JSON.stringify(out, null, 2), 'utf8'); } catch {}
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


