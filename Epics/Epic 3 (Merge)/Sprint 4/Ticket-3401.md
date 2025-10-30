# Ticket-3401 — Span helpers for Code Mode runs

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3401 — Span helpers for Code Mode runs")

What / Why
- Add helpers to create spans for codemode.run, codemode.compile, codemode.eval, and per-tool call subspans.

Where
- /orchestrator/src/codemode/telemetry.ts

Implementation sketch
- Export withRunSpan(runId, fn), withCompileSpan, withEvalSpan, withToolCallSpan(toolName, fn).
- Attach attributes: { run_id, user_id?, tool_name?, catalog_hash? }.

Tests
- tests/sprint4-obs/spans_compile_eval.spec.ts: with OTEL_TEST=true, spans created with names/attrs.

Accept when
- In-memory exporter sees expected spans/attrs.

Process
- Implement → write tests → run → fix → push.
