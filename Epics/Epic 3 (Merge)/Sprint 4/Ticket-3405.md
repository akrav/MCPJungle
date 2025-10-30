# Ticket-3405 — Limit enforcement telemetry (timeouts, memory, output, tool-calls)

Source: Epics/Epic 3 (Merge)/Sprint 4/Sprint 4 Overview.md (section "Ticket-3405 — Limit enforcement telemetry (timeouts, memory, output, tool-calls)")

What / Why
- When SecurityPolicy caps are hit, emit incErrors('limit_exceeded') and a span event with { limit: 'maxExecutionTime'|'maxMemoryMB'|'maxOutputBytes'|'maxToolCalls' }.

Where
- Runner (policy integration) and /orchestrator/src/codemode/telemetry.ts

Implementation sketch
- On each limit breach in runner, call metric + span event; keep diagnostics minimal.

Tests
- tests/sprint4-obs/limits_telemetry.spec.ts: force each limit; assert counter increments + span event recorded.

Accept when
- All four limits generate telemetry.

Process
- Implement → write tests → run → fix → push.
