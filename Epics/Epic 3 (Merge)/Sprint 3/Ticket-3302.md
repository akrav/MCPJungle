# Ticket-3302 — Codemode invoker contract

Source: Epics/Epic 3 (Merge)/Sprint 3/Sprint 3 Overview.md (section "Ticket-3302 — Codemode invoker contract")

What / Why
- Define invokeTool(fn, args, ctx) mapping to JSON-RPC tools/call via upstream helper.

Where
- /orchestrator/src/codemode/invoker.ts

Implementation sketch
- Build JSON-RPC { jsonrpc:'2.0', id, method:'tools/call', params:{ name: fn, arguments: args } }.
- Use postToJungle; content-type guard; return result content.

Tests
- tests/sprint3-bridge/invoker_tools_call.spec.ts: body shape and returned content.

Accept when
- Correct envelope produced and surfaced.

Process
- Implement → write tests → run → fix → push.
