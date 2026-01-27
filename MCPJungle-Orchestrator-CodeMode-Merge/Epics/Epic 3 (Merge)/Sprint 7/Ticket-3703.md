# Ticket-3703 — Retry/backoff & idempotency assertions (bridge)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3703 — Retry/backoff & idempotency assertions (bridge)")

What / Why
- Verify 502/503 retry with backoff does not duplicate tool semantics; unique IDs per attempt; within retry budget.

Where
- /orchestrator/tests/sprint7-hardening/retry_idempotency.spec.ts

Implementation sketch
- Mock upstream to 502 twice then 200; assert attempt count, unique upstream IDs, single logical result.

Accept when
- Attempts/jitter observed; no duplicate side-effects.

Process
- Implement → run → fix → push.
