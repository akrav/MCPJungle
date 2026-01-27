# Ticket-3607 — Fallback to shared on provision failure (parity w/ Sprint 5)

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3607 — Fallback to shared on provision failure (parity w/ Sprint 5)")

What / Why
- If auto-provision fails or health check times out, route to shared Jungle and log warning with reason.

Where
- /orchestrator/src/routing/router.ts

Implementation sketch
- try/catch around provision/health; log('warn','route_fallback_shared',{ user_id, reason }); return { baseUrl:JUNGLE_URL, mode:'shared' }.

Tests
- tests/sprint6-provisioning/fallback_on_fail.spec.ts: force provision error; assert fallback + warning log.

Accept when
- Deterministic fallback with clear diagnostics.

Process
- Implement → write tests → run → fix → push.
