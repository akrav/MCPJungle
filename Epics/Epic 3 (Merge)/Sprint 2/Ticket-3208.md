# Ticket-3208 — Correlation ID (runId) propagation (logs only)

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3208 — Correlation ID (runId) propagation (logs only)")

What / Why
- Add a runId parameter and include it in structured logs for later tracing integration.

Where
- runner.ts (param) and obs/log.ts usage in tests

Implementation sketch
- Generate UUIDv7 if not provided; pass through to all runner log lines.

Tests
- tests/sprint2-codemode/correlation_id.spec.ts: logs contain stable runId across messages.

Accept when
- Logs include runId for each run; no PII.

Process
- Implement → write tests → run → fix → push.
