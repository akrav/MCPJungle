# Ticket-3305 — Cancel propagation from runner

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3305 — Cancel propagation from runner")

What / Why
- Forward a cancel for the same JSON-RPC id when runner signals cancellation; ensure single terminal outcome.

Where
- /orchestrator/src/codemode/invoker.ts + runner integration (cancelToken)

Implementation sketch
- Track in-flight id; on cancel, POST { method:'cancel', params:{ id } } to Jungle; ensure clean end.

Tests
- tests/sprint3-bridge/cancel_propagation.spec.ts: long-running stub → cancel → exactly one terminal result.

Accept when
- No double-finalization; streams closed.

Process
- Implement → write tests → run → fix → push.
