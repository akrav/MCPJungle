# Ticket-3307 — Header hygiene for invoker

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3307 — Header hygiene for invoker")

What / Why
- Replicate relay header rules: strip hop-by-hop; set User-Agent, Forwarded, optional Authorization, x-user-id.

Where
- /orchestrator/src/server/upstream.ts

Implementation sketch
- Ensure header contract identical to relay when using dynamic baseUrl.

Tests
- tests/sprint3-bridge/header_hygiene_bridge.spec.ts: assert required headers present/absent per config.

Accept when
- Headers match relay expectations.

Process
- Implement → write tests → run → fix → push.
