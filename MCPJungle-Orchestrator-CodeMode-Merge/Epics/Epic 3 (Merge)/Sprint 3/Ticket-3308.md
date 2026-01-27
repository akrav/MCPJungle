# Ticket-3308 — Correlation ID propagation (runId)

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3308 — Correlation ID propagation (runId)")

What / Why
- Include runId in invoker logs; propagate as trace/log fields for later OTel wiring.

Where
- /orchestrator/src/codemode/invoker.ts and log calls

Implementation sketch
- Log start/end and per-chunk with runId.

Tests
- tests/sprint3-bridge/correlation_id_bridge.spec.ts: logs include runId on start/end and per-chunk.

Accept when
- Logs consistently include runId.

Process
- Implement → write tests → run → fix → push.
