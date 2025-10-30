# Ticket-3201 — Runner facade (IsolatedExecutor integration)

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3201 — Runner facade (IsolatedExecutor integration)")

What / Why
- Create runner.ts exposing runCode({ code, invoker, security }): Promise<{ result; diagnostics? }>, internally using IsolatedExecutor. Centralizes execution concerns.

Where
- /orchestrator/src/codemode/runner.ts

Implementation sketch
- Import IsolatedExecutor from codemode-standalone.
- Minimal ToolRegistry with dynamic tool namespace handled by binding Proxy.
- Map exceptions to { diagnostics: { message } } without leaking stacks.

Tests
- tests/sprint2-codemode/result_envelope.spec.ts: success returns { result }; errors return { diagnostics.message }.

Accept when
- Trivial code (no calls) runs and returns correct envelope.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.
