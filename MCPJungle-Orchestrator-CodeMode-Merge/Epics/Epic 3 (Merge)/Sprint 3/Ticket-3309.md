# Ticket-3309 — E2E: two sequential tool calls via bridge (stub Jungle)

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3309 — E2E: two sequential tool calls via bridge (stub Jungle)")

What / Why
- End-to-end confirm: runner executes code calling two tools; invoker forwards both; stub Jungle returns expected JSON.

Where
- Tests only (mock/stub Jungle server or mocked upstream)

Implementation sketch
- Code: await codemode["a__t1"](x); await codemode["b__t2"](y); return {...}; ensure sequencing.

Tests
- tests/sprint3-bridge/e2e_two_calls_stub_jungle.spec.ts: asserts order, names/args, final result shape.

Accept when
- E2E passes without flakiness.

Process
- Implement → write tests → run → fix → push.
