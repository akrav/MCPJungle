# Ticket-3104 — Prompt builder (emit-code-only contract)

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3104 — Prompt builder (emit-code-only contract)")

What / Why
- Provide a compact prompt listing function names + descriptions; instruct model to output only a single async function using `codemode`.

Where
- /orchestrator/src/codemode/prompt.ts

Implementation sketch
- Input: { functions: Array<{ name: string; description: string }> }.
- Output: string with brief context, guardrails (no commentary), usage example `await codemode["server__tool"](args)`.

Tests
- tests/sprint1-codemode/prompt_contract.spec.ts: contains all function names; includes “output only code”, “single async function”; no secrets.

Accept when
- Prompt contains names and guardrails; length within threshold.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.
