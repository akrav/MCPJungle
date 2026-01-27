# Ticket-3501 — Router module contract

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3501 — Router module contract")

What / Why
- Create router.ts exposing resolveJungleEndpoint({ userId }): { baseUrl, mode: 'shared'|'per_user' } using config + optional store mapping.

Where
- /orchestrator/src/routing/router.ts

Implementation sketch
- Read ROUTING_MODE ('shared'|'per_user', default 'shared').
- If 'shared' or missing userId → { baseUrl: JUNGLE_URL, mode:'shared' }.
- If 'per_user' → consult store map; return mapped endpoint when present.

Tests
- tests/sprint5-routing/router_contract.spec.ts: table-driven (no userId, shared, per_user present/absent).

Accept when
- Correct { baseUrl, mode } in all cases.

Process
- Implement → write tests → run → fix → push.
