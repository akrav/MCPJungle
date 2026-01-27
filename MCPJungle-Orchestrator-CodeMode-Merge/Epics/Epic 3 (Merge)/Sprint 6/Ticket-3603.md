# Ticket-3603 — Health polling with timeout/backoff

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3603 — Health polling with timeout/backoff")

What / Why
- Poll GET /health on the provisioned endpoint until healthy or timeout.

Where
- /orchestrator/src/provisioning/health.ts

Implementation sketch
- waitForHealthy(baseUrl, { timeoutMs, backoffMs }) using undici fetch; success on 200 JSON {status:'ok'}.
- Exponential backoff with jitter; abort at timeout.

Tests
- tests/sprint6-provisioning/health_polling.spec.ts: simulate responses; assert backoff and timeout.

Accept when
- Deterministic retry/backoff; clean abort.

Process
- Implement → write tests → run → fix → push.
