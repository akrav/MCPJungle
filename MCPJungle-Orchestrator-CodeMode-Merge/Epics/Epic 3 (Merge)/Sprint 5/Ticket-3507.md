# Ticket-3507 — Fallback to shared on missing per-user mapping

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3507 — Fallback to shared on missing per-user mapping")

What / Why
- If ROUTING_MODE=per_user but no mapping for userId, route to shared JUNGLE_URL and log a warning.

Where
- /orchestrator/src/routing/router.ts and /orchestrator/src/obs/log.ts usage

Implementation sketch
- Return { baseUrl:JUNGLE_URL, mode:'shared' } and log('warn','route_fallback_shared',{ user_id }).

Tests
- tests/sprint5-routing/fallback_shared_mode.spec.ts: warning log with user_id; baseUrl equals shared.

Accept when
- Deterministic fallback with clear logs.

Process
- Implement → write tests → run → fix → push.
