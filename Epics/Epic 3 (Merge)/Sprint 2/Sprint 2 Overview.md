# Sprint 2 — Locked-Down Sandbox Runtime (reuse codemode-standalone isolate)

**Goal**  
Run LLM-emitted code in an isolated, permissionless runtime with strict caps (time/memory/output/tool-calls) and only the `codemode` binding available. Reuse `codemode-standalone`’s `IsolatedExecutor` and `SecurityPolicy`. Do not rebuild a sandbox.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to branch `Orchestrator-CodeMode-Merge`. If any test fails, loop/fix and re-run until green before pushing.

**What we will reuse (preexisting)**

* From `codemode-standalone`:
  * `IsolatedExecutor` (per-execution isolate)
  * `SecurityPolicy` (limits)
  * `ExecutionContext` (if needed)
* From Epic 3 Sprint 1 (already added in orchestrator):
  * `src/codemode/{typegen.ts,prompt.ts,cache.ts,index.ts}`

**Repo layout (S2 additions highlighted)**

```
/orchestrator
  /src
    /codemode
      runner.ts                                # NEW in S2 (facade around IsolatedExecutor)
      binding.ts                               # NEW in S2 (`codemode` Proxy → out-call invoker)
      policy.ts                                # NEW in S2 (SecurityPolicy wiring)
    /obs/log.ts                                # reuse; add runId logs in tests
  /tests/sprint2-codemode                      # NEW in S2
    binding_proxy_forward.spec.ts
    limits_timeout.spec.ts
    limits_memory.spec.ts
    limits_tool_calls.spec.ts
    deny_ambient_apis.spec.ts
    result_envelope.spec.ts
    correlation_id.spec.ts
    happy_path_stub_invoker.spec.ts
```

---

## Ticket-3201 — Runner facade (`IsolatedExecutor` integration)

**What / Why**  
Create `runner.ts` that exposes `runCode({ code, invoker, security }): Promise<{ result: unknown; diagnostics?: { message: string } }>` and internally uses `IsolatedExecutor`. Keeps execution concerns centralized.

**Where**  
`/orchestrator/src/codemode/runner.ts`

**Implementation sketch**

* Import `IsolatedExecutor` from `codemode-standalone`.
* Build a minimal ToolRegistry with a single dynamic tool namespace handled by our `binding` Proxy (next ticket).
* Catch exceptions; map to `{ diagnostics: { message } }` without leaking stack internals.

**Tests**  
`result_envelope.spec.ts`: success returns `{ result }`; thrown error returns `{ diagnostics.message }`.

**Accept when**  
Runner executes trivial code (no calls) and returns correct envelope.

**LLM priming**  
`IsolatedExecutor`, `ToolRegistry`, `try/catch map error → diagnostics`

---

## Ticket-3202 — `codemode` binding Proxy → `invoker` hook

**What / Why**  
Implement `binding.ts` to provide a `Proxy` that traps property access and returns an async function which forwards `{ fn, args }` to a provided `invoker` callback (stubbed this sprint).

**Where**  
`/orchestrator/src/codemode/binding.ts`

**Implementation sketch**

* `createCodemodeBinding(invoker: (fn: string, args: unknown) => Promise<unknown>)`.
* Proxy: `get(target, prop)` returns `async (args) => invoker(String(prop), args)`; reject symbols/non-strings.

**Tests**  
`binding_proxy_forward.spec.ts`: access `codemode["weather__forecast"]` and call with `{city:"SF"}` → invoker receives exactly those values.

**Accept when**  
Names and arguments forwarded verbatim; non-string props throw clear error.

**LLM priming**  
`new Proxy`, `Reflect.get`, `typeof prop === 'string'`

---

## Ticket-3203 — SecurityPolicy wiring (time/memory/output/tool-calls)

**What / Why**  
Provide `policy.ts` that exports a `DEFAULT_SECURITY_POLICY` and a function to build per-run limits; enforce in the runner.

**Where**  
`/orchestrator/src/codemode/policy.ts`

**Implementation sketch**

* Import `SecurityPolicy` from `codemode-standalone`.
* Defaults: `maxExecutionTime=10000ms`, `maxMemoryMB=128`, `maxToolCalls=50`, `maxOutputBytes=1_000_000`, `allowNetworkAccess=false`.
* Runner consumes these and throws `LimitExceeded` when breached.

**Tests**  
`limits_tool_calls.spec.ts`: loop calls > max; last call rejects with `LimitExceeded`.

**Accept when**  
All limits are configurable via function args and enforced in runner.

**LLM priming**  
`DEFAULT_SECURITY_POLICY`, `limit exceeded`, `configurable caps`

---

## Ticket-3204 — Timeout enforcement (infinite loop test)

**What / Why**  
Ensure infinite loops or long sleeps abort under `maxExecutionTime`.

**Where**  
Tests + runner integration.

**Implementation sketch**

* Code sample: `while(true){}` or `for(;;){}`.
* Expect diagnostic with message containing "timed out".

**Tests**  
`limits_timeout.spec.ts`: verifies timeout triggers and runner returns diagnostics, not a hung process.

**Accept when**  
Run ends within `maxExecutionTime + small delta` and reports timeout.

**LLM priming**  
`maxExecutionTime`, `abort`, `deadline`

---

## Ticket-3205 — Memory cap enforcement

**What / Why**  
Prevent pathological memory use from crashing the host.

**Where**  
Tests + runner.

**Implementation sketch**

* Code: allocate large array `new Array(1e8).fill(0)` guarded for environment; expect early termination with `LimitExceeded`.

**Tests**  
`limits_memory.spec.ts`: verifies cap produces diagnostics and terminates cleanly.

**Accept when**  
Run terminates with memory-limit diagnostics; host process remains responsive.

**LLM priming**  
`maxMemoryMB`, `guard rail`, `graceful termination`

---

## Ticket-3206 — Deny ambient APIs (network, fs, timers, crypto)

**What / Why**  
Guarantee only `codemode` binding is exposed; no ambient `fetch`, `fs`, `setTimeout`, `crypto.subtle`, etc.

**Where**  
Runner/binding configuration and tests.

**Implementation sketch**

* Ensure the sandbox has no globals or they are stubbed to throw; in Node environments, do not leak host globals to the isolate.

**Tests**  
`deny_ambient_apis.spec.ts`: code calling `fetch`/`setTimeout`/`crypto.subtle` throws deterministic error.

**Accept when**  
Ambient API use is impossible; errors are clear and consistent.

**LLM priming**  
`no ambient network`, `stubs`, `permissionless runtime`

---

## Ticket-3207 — Result envelope + diagnostics contract

**What / Why**  
Standardize the return shape and minimal diagnostics to avoid leaking internals.

**Where**  
`runner.ts` and tests.

**Implementation sketch**

* Result: `{ result: unknown }` on success.
* Diagnostics: `{ diagnostics: { message: string } }` on error; no stack traces.

**Tests**  
`result_envelope.spec.ts`: verify shapes and absence of stack traces.

**Accept when**  
All tests confirm shapes and redaction.

**LLM priming**  
`minimal diagnostic surface`, `no stack`, `structured`

---

## Ticket-3208 — Correlation ID (runId) propagation (logs only)

**What / Why**  
Add a `runId` parameter and include it in structured logs for later tracing integration.

**Where**  
`runner.ts` (param) and `obs/log.ts` usage in tests.

**Implementation sketch**

* Generate UUIDv7 if not provided; pass through to all runner log lines.

**Tests**  
`correlation_id.spec.ts`: capture logs; assert `runId` present and stable across messages.

**Accept when**  
Logs include `runId` for each run; no PII.

**LLM priming**  
`uuidv7`, `structured logs`, `correlation id`

---

## Ticket-3209 — Happy path with stub invoker

**What / Why**  
End-to-end confirm: code calls `codemode["server__tool"](args)` → our invoker receives it and returns a stub value.

**Where**  
Runner + binding; test only.

**Implementation sketch**

* Stub invoker returns `{ ok: true }` for any function; code uses two sequential calls and returns an object.

**Tests**  
`happy_path_stub_invoker.spec.ts`: result equals expected object; invoker called twice with the right names/args.

**Accept when**  
Green path is fully working without Jungle wiring (that’s Sprint 3).

**LLM priming**  
`sequential awaits`, `compose results`, `deterministic stub`

---

## How to run Sprint 2 tests locally

```bash
# Install deps
npm i

# Run only Sprint 2 (codemode) tests
npm run test -- tests/sprint2-codemode

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S2: sandbox runtime wired with limits"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* This sprint focuses on safe execution only. Jungle bridging lands in Sprint 3.
* Reuse is mandatory: `IsolatedExecutor`, `SecurityPolicy` from `codemode-standalone`.
* Keep tests deterministic and fast; no network or file system use.

### References

* Code Mode idea and benefits (fewer round-trips, sandboxed execution): [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)
* MCP tools semantics (for next sprint’s bridge): [Model Context Protocol — Tools](https://modelcontextprotocol.io/specification/2025-03-26/server/tools)


