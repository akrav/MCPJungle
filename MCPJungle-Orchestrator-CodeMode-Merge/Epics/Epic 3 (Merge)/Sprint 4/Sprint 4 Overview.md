# Sprint 4 — Observability & Security Controls (MVP)

**Goal**  
Instrument Code Mode runs (compile/eval/tool-calls) with spans, metrics, and structured logs; enforce and surface security caps (timeouts, memory, output, tool-call limits) with clear diagnostics. Reuse orchestrator `obs/otel.ts`, `obs/log.ts`, and codemode runner from Sprints 1–3.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to `Orchestrator-CodeMode-Merge`. If tests fail, loop until green before pushing.

**What we will reuse**

* Orchestrator: `src/obs/otel.ts`, `src/obs/log.ts` (start/stop OTel, structured logs, test mode spans)
* Code Mode: `src/codemode/{runner.ts,binding.ts,policy.ts,invoker.ts,index.ts}`
* Config: `src/config/{schema.ts,load.ts}`

**Repo layout (S4 additions highlighted)**

```
/orchestrator
  /src
    /codemode
      telemetry.ts                           # NEW in S4 (span/metric helpers for runs)
    /obs
      otel.ts                                # reuse (extend helpers)
      log.ts                                 # reuse (add fields)
    /config
      schema.ts                              # extend with env flags
      load.ts                                # extend with defaults
  /tests/sprint4-obs                         # NEW in S4
    spans_compile_eval.spec.ts
    metrics_counters_histograms.spec.ts
    logs_shape_redaction.spec.ts
    limits_telemetry.spec.ts
    config_flags.spec.ts
    e2e_obs_codemode_run.spec.ts
```

---

## Ticket-3401 — Span helpers for Code Mode runs

**What / Why**  
Add `telemetry.ts` with helpers to create spans for `codemode.run`, `codemode.compile`, `codemode.eval`, and subspans for each tool call. Use existing `startOtel()` tracer; support `OTEL_TEST=true` in CI.

**Where**  
`/orchestrator/src/codemode/telemetry.ts`

**Implementation sketch**

* Export `withRunSpan(runId, fn)`, `withCompileSpan`, `withEvalSpan`, `withToolCallSpan(toolName, fn)`.
* Each helper attaches attributes: `{ run_id, user_id?, tool_name?, catalog_hash? }`.

**Tests**  
`spans_compile_eval.spec.ts`: with `OTEL_TEST=true`, assert spans created with names/attrs.

**Accept when**  
Tests capture expected span names and attributes in memory exporter.

**LLM priming**  
`OpenTelemetry spans`, `attributes`, `OTEL_TEST`

---

## Ticket-3402 — Metrics: compile/eval histograms, tool-call and error counters

**What / Why**  
Emit histograms for compile and eval durations; counters for `tool_calls_total` and `codemode_errors_total` by category (`compile`, `eval`, `invoke`, `limit_exceeded`).

**Where**  
`/orchestrator/src/codemode/telemetry.ts` and/or `obs/otel.ts`

**Implementation sketch**

* Provide `recordCompileMs(ms)`, `recordEvalMs(ms)`, `incToolCalls(n)`, `incErrors(kind)`; wire into runner and invoker.

**Tests**  
`metrics_counters_histograms.spec.ts`: call helpers; assert exporter saw increments/records.

**Accept when**  
Metrics recorded with expected labels and counts.

**LLM priming**  
`histogram`, `counter`, `labels`

---

## Ticket-3403 — Structured logs for runs (runId, hashes, counts)

**What / Why**  
Add log fields on start/end of a run: `{ run_id, user_id, code_hash, catalog_hash, tool_calls, duration_ms }`.

**Where**  
`/orchestrator/src/obs/log.ts` (call site usage in runner/invoker)

**Implementation sketch**

* At run start: `log('info','codemode_run_start',{...})`; end: `log('info','codemode_run_end',{...})`.
* Ensure no secrets or raw code in logs; include code hash only.

**Tests**  
`logs_shape_redaction.spec.ts`: assert fields present; confirm no `code` content stored; only `code_hash`.

**Accept when**  
Log records contain expected fields and redact content properly.

**LLM priming**  
`structured logs`, `redaction`, `hash only`

---

## Ticket-3404 — Config flags for telemetry and code persistence (disabled by default)

**What / Why**  
Add env flags: `CODEMODE_TELEMETRY=true|false` and `CODEMODE_PERSIST_CODE=true|false` (default `false`). When persistence is enabled (dev-only), store last N code snippets with redaction.

**Where**  
`/orchestrator/src/config/{schema.ts,load.ts}` and small in-memory buffer in `telemetry.ts` (bounded, e.g., N=20).

**Implementation sketch**

* Zod schema booleans with defaults; loader maps to config. Persistence stores `{ run_id, code_hash, redacted_preview }` only.

**Tests**  
`config_flags.spec.ts`: defaults false; when enabled, buffer retains at most N entries; preview is redacted.

**Accept when**  
Flags parse and drive behavior; buffer bounded.

**LLM priming**  
`z.boolean().default(false)`, `ring buffer`, `preview`

---

## Ticket-3405 — Limit enforcement telemetry (timeouts, memory, output, tool-calls)

**What / Why**  
When `SecurityPolicy` caps are hit, emit `incErrors('limit_exceeded')` and add a span event with `{ limit: 'maxExecutionTime'|'maxMemoryMB'|'maxOutputBytes'|'maxToolCalls' }`.

**Where**  
Runner (policy integration) and `telemetry.ts`.

**Implementation sketch**

* On each limit breach in runner, call metric + span event; keep diagnostics minimal.

**Tests**  
`limits_telemetry.spec.ts`: force each limit; assert counter increments and span event recorded.

**Accept when**  
All four limits generate telemetry.

**LLM priming**  
`span.addEvent`, `labels`, `limit_exceeded`

---

## Ticket-3406 — E2E observability for a successful Code Mode run

**What / Why**  
End-to-end: code calls two tools via stub Jungle; verify spans, metrics, and logs populated consistently.

**Where**  
Test only.

**Implementation sketch**

* Enable `OTEL_TEST=true`; run a small code snippet using two `codemode[...]` calls; assert compile/eval spans, tool-call counts, and start/end logs.

**Tests**  
`e2e_obs_codemode_run.spec.ts`: validates all observability signals and redaction.

**Accept when**  
All signals present; counts and timings are non-zero and coherent.

**LLM priming**  
`OTEL_TEST=true`, `coherent timings`, `non-zero counts`

---

## How to run Sprint 4 tests locally

```bash
# Install deps
npm i

# Enable test-mode spans for OTel
export OTEL_TEST=true

# Run only Sprint 4 (obs) tests
npm run test -- tests/sprint4-obs

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S4: observability + security controls"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* Keep returns atomic for Code Mode (aggregate stream → final JSON); observability uses spans/metrics/logs, not model-visible streams.
* Persistence is dev-only and redacted; production default is disabled.
* Follow Cloudflare Code Mode guidance on isolation and bindings to minimize exposed surface.  
  See: [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)


