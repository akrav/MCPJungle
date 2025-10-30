# Ticket-3509 — E2E: two users routed to different endpoints (stub)

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3509 — E2E: two users routed to different endpoints (stub)")

What / Why
- End-to-end: user A and user B resolve to different Jungle endpoints via the store; run a minimal Code Mode call per user (stub upstream) and verify separation.

Where
- Test only

Implementation sketch
- Preload store with two endpoints; issue invocations with different x-user-id; assert requests hit correct baseUrl and results distinct.

Tests
- tests/sprint5-routing/e2e_two_users_two_endpoints.spec.ts: order-insensitive assertions on observed baseUrls.

Accept when
- E2E passes; no leakage between users.

Process
- Implement → write tests → run → fix → push.
