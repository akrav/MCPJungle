# Ticket-3202 — codemode binding Proxy → invoker hook

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3202 — `codemode` binding Proxy → `invoker` hook")

What / Why
- Implement binding.ts to provide a Proxy that traps property access and returns an async function which forwards { fn, args } to a provided invoker callback.

Where
- /orchestrator/src/codemode/binding.ts

Implementation sketch
- createCodemodeBinding(invoker: (fn: string, args: unknown) => Promise<unknown>).
- Proxy get: returns async (args) => invoker(String(prop), args); reject symbols/non-strings.

Tests
- tests/sprint2-codemode/binding_proxy_forward.spec.ts: access codemode["weather__forecast"] with args; invoker receives exactly those values.

Accept when
- Names and arguments forwarded verbatim; non-string props error clearly.

Status: Completed – 2025-10-31

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.
