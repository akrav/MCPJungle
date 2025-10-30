# Ticket-3606 — Metrics & logs for provisioning lifecycle

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3606 — Metrics & logs for provisioning lifecycle")

What / Why
- Emit metrics and logs around provision/health/teardown to observe readiness and stability.

Where
- /orchestrator/src/obs/otel.ts, /orchestrator/src/obs/log.ts; call sites in provisioning/router

Implementation sketch
- Metrics: provision_time_ms histogram; counters provision_attempts_total, provision_failures_total; gauge instances_active.
- Logs: provision_start, provision_ready, provision_failed, teardown_done { user_id, baseUrl }.

Tests
- tests/sprint6-provisioning/metrics_and_logs.spec.ts: counters/histogram increments and log fields present (test exporter).

Accept when
- Signals recorded with correct labels; logs structured.

Process
- Implement → write tests → run → fix → push.
