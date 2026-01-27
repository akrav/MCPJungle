# Sprint 7 — Hardening, Soak, and Docs

**Goal**  
Stabilize the Orchestrator + Code Mode + Jungle stack under real usage patterns: soak tests, chaos drills, size caps, auth gates, and documentation. Keep defaults safe: shared routing by default; provisioning feature‑flagged. Ensure CI runs targeted suites reliably.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to `Orchestrator-CodeMode-Merge`. If tests fail, loop until green before pushing.

**What we will reuse**

* Code Mode: `src/codemode/{runner.ts,invoker.ts,policy.ts,telemetry.ts}`
* Relay/Upstream: `src/server/{http.ts,upstream.ts}`
* Routing/Provisioning: `src/routing/{router.ts,store.ts}`, `src/provisioning/*` (feature‑flagged)
* Observability: `src/obs/{otel.ts,log.ts}`
* Config: `src/config/{schema.ts,load.ts}`

**Repo layout (S7 additions highlighted)**

```
/orchestrator
  /tests/sprint7-hardening                     # NEW in S7
    soak_codemode_short.spec.ts
    chaos_restart_jungle.spec.ts
    retry_idempotency.spec.ts
    size_caps_end_to_end.spec.ts
    authn_authz_gates.spec.ts
    docs_quickstart_smoke.spec.ts
    examples_gallery_smoke.spec.ts
    ci_matrix_config.spec.ts
```

---

## Ticket-3701 — Soak: many short Code Mode runs (stub Jungle)

**What / Why**  
Run N (e.g., 200) short Code Mode executions that call 2 tools sequentially against a stub Jungle and record p50/p95 eval time and success rate.

**Where**  
`/tests/sprint7-hardening/soak_codemode_short.spec.ts`

**Implementation sketch**

* Loop with limited concurrency (pool of, say, 10); for each run, execute simple two‑call program and collect timings.
* Assert success rate ≥ 99% and p95 under a reasonable threshold (config variable).

**Accept when**  
Soak test passes locally/CI (guarded thresholds); prints a brief summary.

**LLM priming**  
`Promise.allSettled`, `p95`, `concurrency pool`, `timing summary`

---

## Ticket-3702 — Chaos: restart Jungle mid‑run (error hygiene)

**What / Why**  
Simulate a restart/error from upstream Jungle during an in‑flight tool call; verify the invoker maps errors deterministically and the run terminates cleanly.

**Where**  
`/tests/sprint7-hardening/chaos_restart_jungle.spec.ts`

**Implementation sketch**

* Stub upstream to close connection or return 502 mid‑stream; ensure Code Mode returns a structured error (no hangs, no double terminal).

**Accept when**  
Run fails with expected JSON‑RPC mapping and closed stream.

**LLM priming**  
`mid-stream close`, `-32000 mapping`, `single terminal`

---

## Ticket-3703 — Retry/backoff & idempotency assertions (bridge)

**What / Why**  
Verify 502/503 retry with backoff does not duplicate tool semantics and remains within retry budget; ensure unique IDs per attempt.

**Where**  
`/tests/sprint7-hardening/retry_idempotency.spec.ts`

**Implementation sketch**

* Mock upstream to 502 twice then 200; assert attempt count and unique upstream IDs; ensure only one logical result.

**Accept when**  
Attempts and jitter observed; no duplicate side‑effects.

**LLM priming**  
`exponential backoff`, `retry budget`, `unique request id`

---

## Ticket-3704 — Size caps end‑to‑end (input/output)

**What / Why**  
Confirm that oversized inputs/outputs trigger limits and clean diagnostics without destabilizing the process.

**Where**  
`/tests/sprint7-hardening/size_caps_end_to_end.spec.ts`

**Implementation sketch**

* Drive a Code Mode run producing an output > `maxOutputBytes`; assert `LimitExceeded` and clean end.
* Drive a request body exceeding JSON size limit to `/mcp`; assert `-32600 InvalidRequest`.

**Accept when**  
Both paths enforce caps with expected errors; no resource leaks.

**LLM priming**  
`maxOutputBytes`, `content-length guard`, `-32600`

---

## Ticket-3705 — AuthN/AuthZ sanity (allowlists, BOLA guard)

**What / Why**  
Validate basic authentication and authorization wiring: reject missing/invalid bearer tokens and disallow cross‑tenant tool access.

**Where**  
`/tests/sprint7-hardening/authn_authz_gates.spec.ts`

**Implementation sketch**

* Simulate requests without token and with invalid token → 401/403.
* If an allowlist exists (config/mock), ensure disallowed `server__tool` is blocked.

**Accept when**  
Unauthorized blocked; allowlist enforced.

**LLM priming**  
`bearer`, `403`, `allowlist`, `API1: BOLA`

---

## Ticket-3706 — Docs: Quickstart (Code Mode path) + Operator runbook

**What / Why**  
Document how to run Code Mode via orchestrator (shared routing) and how to enable per‑user mode; add troubleshooting notes.

**Where**  
`/orchestrator/README.md` (sections), or `/docs/` if present; tests just smoke the headings.

**Implementation sketch**

* Add “Code Mode Quickstart” with envs, example curl, and expected JSON snippet.
* Add “Operator Runbook” for routing modes, feature flags, and viewing logs/metrics.

**Tests**  
`docs_quickstart_smoke.spec.ts`: grep file for headings and code blocks.

**Accept when**  
Headings found and sample commands present.

**LLM priming**  
`README headings`, `Quickstart`, `Runbook`

---

## Ticket-3707 — Examples mini‑gallery (two flows)

**What / Why**  
Ship two tiny example flows that demonstrate multi‑tool composition (e.g., weather→app recommendation, search→summarize), runnable against a stub Jungle.

**Where**  
`/examples/codemode/*` (orchestrator repo); tests smoke load and run them with env flags.

**Implementation sketch**

* Provide scripts that call into the orchestrator Code Mode path; print `{ result }` only.

**Tests**  
`examples_gallery_smoke.spec.ts`: ensure examples output a JSON object and exit 0.

**Accept when**  
Both examples run deterministically.

**LLM priming**  
`node examples/...`, `stdout JSON`, `exit 0`

---

## Ticket-3708 — CI matrix: include S1–S7 suites with flags

**What / Why**  
Wire CI to run sprint‑scoped suites (S1–S7). Keep docker/provisioning tests behind flags to avoid flaky builds on PRs.

**Where**  
`.github/workflows/ci.yml`

**Implementation sketch**

* Add jobs that run `tests/sprint*-*` by pattern; set env flags for OTEL tests; skip provisioning unless explicitly enabled.

**Tests**  
`ci_matrix_config.spec.ts`: parse YAML (as text) and assert presence of key jobs/steps.

**Accept when**  
CI workflow contains suites and flags; local test verifies structure.

**LLM priming**  
`matrix`, `include`, `env`, `paths`

---

## How to run Sprint 7 tests locally

```bash
# Install deps
npm i

# Run only Sprint 7 (hardening) tests
npm run test -- tests/sprint7-hardening

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S7: hardening, soak, docs"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* Keep thresholds reasonable and configurable so CI remains stable.
* Favor stubs/mocks for Jungle to avoid network flake.
* Default routing remains `shared`; provisioning is still feature‑flagged and exercised only where explicitly enabled.


