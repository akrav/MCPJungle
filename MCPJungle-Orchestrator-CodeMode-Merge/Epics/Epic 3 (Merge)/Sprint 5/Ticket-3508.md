# Ticket-3508 — Route decision logging & metrics

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3508 — Route decision logging & metrics")

What / Why
- Log { mode, user_id, baseUrl } and increment counters per mode to observe adoption.

Where
- /orchestrator/src/routing/router.ts + /orchestrator/src/obs/otel.ts

Implementation sketch
- log('info','route_decision',{ ... }); incCounter('route_mode_total',{ mode }).

Tests
- tests/sprint5-routing/route_decision_logging.spec.ts: assert log fields and counter increments.

Accept when
- Logs and metrics present and labeled.

Process
- Implement → write tests → run → fix → push.
