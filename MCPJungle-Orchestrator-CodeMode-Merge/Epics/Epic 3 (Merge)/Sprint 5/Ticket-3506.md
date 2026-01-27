# Ticket-3506 — Header hygiene remains intact after routing

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3506 — Header hygiene remains intact after routing")

What / Why
- Ensure User-Agent, Forwarded, optional Authorization, x-user-id, and session header logic are unchanged when using dynamic endpoints.

Where
- /orchestrator/src/server/upstream.ts and tests

Implementation sketch
- Verify header contract identical to pre-routing behavior.

Tests
- tests/sprint5-routing/header_hygiene_after_routing.spec.ts: headers match relay’s contract regardless of baseUrl.

Accept when
- Headers identical to pre-routing behavior.

Process
- Implement → write tests → run → fix → push.
