# Ticket-3403 — Structured logs for runs (runId, hashes, counts)

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3403 — Structured logs for runs (runId, hashes, counts)")

What / Why
- Add log fields on start/end of a run: { run_id, user_id, code_hash, catalog_hash, tool_calls, duration_ms }.

Where
- /orchestrator/src/obs/log.ts (call sites in runner/invoker)

Implementation sketch
- log('info','codemode_run_start',{...}); log('info','codemode_run_end',{...}).
- No secrets/raw code; include code hash only.

Tests
- tests/sprint4-obs/logs_shape_redaction.spec.ts: fields present; only code_hash, no raw code.

Accept when
- Logs contain expected fields and redact content properly.

Process
- Implement → write tests → run → fix → push.
