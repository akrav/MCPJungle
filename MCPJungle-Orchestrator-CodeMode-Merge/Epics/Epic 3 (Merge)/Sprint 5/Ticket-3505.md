# Ticket-3505 — Wire router into Code Mode invoker

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3505 — Wire router into Code Mode invoker")

What / Why
- Update codemode/invoker.ts to resolve baseUrl per call using userId from context.

Where
- /orchestrator/src/codemode/invoker.ts

Implementation sketch
- Accept { userId, runId } in invoker context; call router and pass baseUrl to upstream client.

Tests
- tests/sprint5-routing/invoker_uses_router.spec.ts: spy router; ensure baseUrl honored; logs include route decision.

Accept when
- Invoker uses router; tests pass.

Process
- Implement → write tests → run → fix → push.
