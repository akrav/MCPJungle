# Ticket-3504 — Wire router into /mcp relay

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3504 — Wire router into /mcp relay")

What / Why
- Update server/http.ts to call resolveJungleEndpoint({ userId }) and use baseUrl when posting upstream.

Where
- /orchestrator/src/server/http.ts

Implementation sketch
- Extract userId from x-user-id header (string only).
- Replace cfg.jungleUrl with router baseUrl in initialize and pass-through paths.

Tests
- tests/sprint5-routing/relay_uses_router.spec.ts: spy router; ensure called with userId; baseUrl used in fetch.

Accept when
- Relay tests remain green; baseUrl substitution validated.

Process
- Implement → write tests → run → fix → push.
