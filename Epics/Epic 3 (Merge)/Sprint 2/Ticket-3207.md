# Ticket-3207 — Result envelope + diagnostics contract

Source: Epics/Epic 3 (Merge)/Sprint 2/Sprint 2 Overview.md (section "Ticket-3207 — Result envelope + diagnostics contract")

What / Why
- Standardize return shape and minimal diagnostics to avoid leaking internals.

Where
- /orchestrator/src/codemode/runner.ts and tests

Implementation sketch
- Success: { result: unknown }.
- Error: { diagnostics: { message: string } }; no stack traces.

Tests
- tests/sprint2-codemode/result_envelope.spec.ts: verify shapes and redaction.

Accept when
- Shapes correct; no stacks leaked.

Process
- Implement → write tests → run → fix → push.
