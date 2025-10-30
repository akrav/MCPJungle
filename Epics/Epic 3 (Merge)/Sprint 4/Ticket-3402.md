# Ticket-3402 — Metrics: compile/eval histograms, tool-call and error counters

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3402 — Metrics: compile/eval histograms, tool-call and error counters")

What / Why
- Emit histograms for compile/eval durations; counters for tool_calls_total and codemode_errors_total by category.

Where
- /orchestrator/src/codemode/telemetry.ts and/or /orchestrator/src/obs/otel.ts

Implementation sketch
- Provide recordCompileMs(ms), recordEvalMs(ms), incToolCalls(n), incErrors(kind); wire into runner and invoker.

Tests
- tests/sprint4-obs/metrics_counters_histograms.spec.ts: exporter saw increments/records.

Accept when
- Metrics recorded with expected labels and counts.

Process
- Implement → write tests → run → fix → push.
