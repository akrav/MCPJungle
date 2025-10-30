# Ticket-3209 — Happy path with stub invoker

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3209 — Happy path with stub invoker")

What / Why
- End-to-end confirm: code calls codemode["server__tool"](args) → invoker receives it and returns a stub value.

Where
- Runner + binding; test only

Implementation sketch
- Stub invoker returns { ok: true } for any function; code uses two sequential calls and returns an object.

Tests
- tests/sprint2-codemode/happy_path_stub_invoker.spec.ts: result equals expected object; invoker called twice with right names/args.

Accept when
- Green path fully works without Jungle wiring.

Process
- Implement → write tests → run → fix → push.
