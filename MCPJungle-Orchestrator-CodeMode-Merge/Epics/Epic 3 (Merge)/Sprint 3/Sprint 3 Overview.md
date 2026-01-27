# Sprint 3 — Proxy Bridge Orchestrator → MCPJungle (Streaming + Cancel)

**Goal**  
Translate `codemode["server__tool"](args)` calls from the Sprint 2 runner into real MCP calls via the user’s MCPJungle instance, preserving streaming and supporting cancel. Reuse the orchestrator’s existing `/mcp` relay logic (Undici, session header, retries) rather than re‑implementing.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to `Orchestrator-CodeMode-Merge`. If tests fail, loop until green before pushing.

**What we will reuse**

* From `orchestrator/src/server/http.ts`: header patterns, session handling (`Mcp-Session-Id`), retry strategy (502/503), content-type checks.
* From `codemode-standalone` (already integrated): runner and binding from Sprint 2; types from Sprint 1.

**Repo layout (S3 additions highlighted)**

```
/orchestrator
  /src
    /server
      upstream.ts                              # NEW in S3 (shared Jungle client helpers)
    /codemode
      invoker.ts                               # NEW in S3 (Jungle bridge for codemode calls)
      validation.ts                            # NEW in S3 (JSON Schema validation of args)
      index.ts                                 # reuse (wire to invoker)
  /tests/sprint3-bridge                        # NEW in S3
    upstream_extract.spec.ts
    invoker_tools_call.spec.ts
    session_header_forward.spec.ts
    streaming_aggregate.spec.ts
    cancel_propagation.spec.ts
    error_mapping_bridge.spec.ts
    header_hygiene_bridge.spec.ts
    correlation_id_bridge.spec.ts
    e2e_two_calls_stub_jungle.spec.ts
```

---

## Ticket-3301 — Extract shared upstream client helpers

**What / Why**  
Factor Undici + retry + header shaping into `/src/server/upstream.ts` so both HTTP `/mcp` relay and Code Mode invoker use the same implementation.

**Where**  
`/orchestrator/src/server/upstream.ts`, update imports in `server/http.ts` to reuse.

**Implementation sketch**

* Export `postToJungle({ body, headers, timeoutMs }): Promise<Response>` with internal `fetchWithRetry(502/503)` and `AbortSignal.timeout`.
* Centralize `User-Agent`, `Forwarded`, `Authorization`, `x-user-id`, and session header.

**Tests**  
`upstream_extract.spec.ts`: same behavior as before (retry counts, headers present, timeout enforced) using spies/mocks.

**Accept when**  
Existing `/mcp` relay tests remain green after refactor; new helper is covered.

**LLM priming**  
`undici fetch`, `AbortSignal.timeout`, `exponential backoff`, `headers`

---

## Ticket-3302 — Codemode invoker contract

**What / Why**  
Define `invokeTool(fn: string, args: unknown, ctx: { userId: string; runId: string }): Promise<unknown>` and its JSON-RPC envelope mapping for `tools/call`.

**Where**  
`/orchestrator/src/codemode/invoker.ts`

**Implementation sketch**

* Build JSON-RPC request `{ jsonrpc:'2.0', id: <uuid>, method:'tools/call', params:{ name: fn, arguments: args } }`.
* Use `postToJungle` from `server/upstream.ts`; parse JSON with content-type guard; return `result` content.

**Tests**  
`invoker_tools_call.spec.ts`: asserts body shape and that response content is returned.

**Accept when**  
Function composes correct JSON-RPC and surfaces `result`.

**LLM priming**  
`JSON-RPC 2.0`, `tools/call`, `uuid id`

---

## Ticket-3303 — Session header forward + reflection

**What / Why**  
Ensure `Mcp-Session-Id` is forwarded when present and updated when reflected by Jungle.

**Where**  
`/server/upstream.ts` + `invoker.ts`

**Implementation sketch**

* Read `Mcp-Session-Id` from previous response (if any) and set on the next request; update cached value on reflection.

**Tests**  
`session_header_forward.spec.ts`: first call sets session from response; second call sends that header.

**Accept when**  
Header is managed identically to `/mcp` relay.

**LLM priming**  
`res.headers.get('mcp-session-id')`, `res.setHeader('Mcp-Session-Id',...)`

---

## Ticket-3304 — Streaming aggregate to final result

**What / Why**  
Consume a streaming JSON response from Jungle and aggregate to a final object for Code Mode (atomic return), while emitting optional progress logs.

**Where**  
`/codemode/invoker.ts`

**Implementation sketch**

* If `content-type` is `application/json` and body is a stream, incrementally buffer and `JSON.parse` at end; log chunk boundaries with `runId`.

**Tests**  
`streaming_aggregate.spec.ts`: simulated 3 chunks; verify ordered arrival and proper final parse.

**Accept when**  
Final result equals parsed JSON; no end-buffering delay in tests.

**LLM priming**  
`Readable.fromWeb`, `readable.on('data')`, `JSON.parse`

---

## Ticket-3305 — Cancel propagation from runner

**What / Why**  
Forward a cancel for the same JSON-RPC id when the runner signals cancellation; ensure single terminal outcome.

**Where**  
`/codemode/invoker.ts` + runner integration (accept a `cancelToken`).

**Implementation sketch**

* Provide a way to register in-flight id; on cancel, POST `{ method:'cancel', params:{ id } }` to Jungle; ensure clean end.

**Tests**  
`cancel_propagation.spec.ts`: long-running stub → cancel → exactly one terminal result.

**Accept when**  
No double-finalization; streams closed.

**LLM priming**  
`inflight Map`, `single terminal`, `cancel`

---

## Ticket-3306 — Error mapping parity with HTTP relay

**What / Why**  
Match the `/mcp` relay behavior: JSON errors pass-through; non-JSON map to JSON-RPC `-32000` with `data.status`.

**Where**  
`/codemode/invoker.ts`

**Implementation sketch**

* Inspect `content-type`; on non-JSON, return structured server error; include upstream status.

**Tests**  
`error_mapping_bridge.spec.ts`: 502/HTML → `-32000` mapping; JSON-RPC error returns untouched.

**Accept when**  
Deterministic mapping identical to relay.

**LLM priming**  
`content-type sniff`, `-32000 server error`, `data.status`

---

## Ticket-3307 — Header hygiene for invoker

**What / Why**  
Replicate relay header rules: strip hop-by-hop; set `User-Agent`, `Forwarded`, optional `Authorization`, `x-user-id`.

**Where**  
`/server/upstream.ts`

**Tests**  
`header_hygiene_bridge.spec.ts`: asserts required headers present/absent per config.

**Accept when**  
Headers match relay expectations.

**LLM priming**  
`User-Agent`, `Forwarded`, `Authorization`, `x-user-id`

---

## Ticket-3308 — Correlation ID propagation (runId)

**What / Why**  
Include `runId` in invoker logs and propagate as trace/log fields for later OTel wiring.

**Where**  
`/codemode/invoker.ts` and log calls.

**Tests**  
`correlation_id_bridge.spec.ts`: capture logs and assert `runId` present on start/end and per-chunk.

**Accept when**  
Logs consistently include `runId`.

**LLM priming**  
`structured logs`, `runId`, `start/end markers`

---

## Ticket-3309 — E2E: two sequential tool calls via bridge (stub Jungle)

**What / Why**  
End-to-end confirm: runner executes code calling two tools; invoker forwards both; stub Jungle returns expected JSON.

**Where**  
Tests only (mock/stub Jungle server or mocked upstream).

**Implementation sketch**

* Code: `await codemode["a__t1"](x); await codemode["b__t2"](y); return {...}`; ensure sequencing.

**Tests**  
`e2e_two_calls_stub_jungle.spec.ts`: asserts order, names/args, final result shape.

**Accept when**  
E2E passes without flakiness.

**LLM priming**  
`sequential awaits`, `deterministic stub`, `order assertions`

---

## How to run Sprint 3 tests locally

```bash
# Install deps
npm i

# Run only Sprint 3 (bridge) tests
npm run test -- tests/sprint3-bridge

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S3: bridge to MCPJungle (stream + cancel)"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* Keep returns atomic for Code Mode (aggregate stream → final JSON). If you later expose streaming progress to the model, do so via logs/telemetry only.
* Do not change the external `/mcp` contract in this sprint; this is an internal bridge for Code Mode runs.
* Reuse `fetchWithRetry` patterns and header logic to ensure parity with relay behavior.


