# Ticket-3609 — E2E: two users auto-provisioned and isolated (dev, stub upstream)

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3609 — E2E: two users auto-provisioned and isolated (dev, stub upstream)")

What / Why
- End-to-end: with ROUTING_MODE=per_user and PROVISION_ON_DEMAND=true, user A and B get different baseUrls; Code Mode per user hits correct endpoint; results distinct.

Where
- Test only

Implementation sketch
- Mock Docker provisioner + health return distinct baseUrls; verify router calls and invoker requests per user go to correct host:port.

Tests
- tests/sprint6-provisioning/e2e_two_users_isolated_endpoints.spec.ts: calls segregated by userId; no leakage.

Accept when
- E2E passes; logs show route_provisioned for both users.

Process
- Implement → write tests → run → fix → push.
