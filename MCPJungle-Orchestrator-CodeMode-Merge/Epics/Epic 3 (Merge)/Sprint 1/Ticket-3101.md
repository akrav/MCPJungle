# Ticket-3101 — Codemode folder scaffold

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3101 — Codemode folder scaffold")

What / Why
- Create src/codemode/ structure and barrels so later tickets have clean seams. No runtime logic yet.

Where
- /orchestrator/src/codemode/{index.ts,typegen.ts,prompt.ts,cache.ts}

Implementation sketch
- index.ts: export getTypedSurface({ userId }): Promise<{ dts: string; hash: string }> (stub for now).
- Create empty modules with JSDoc responsibilities.

Tests
- tests/sprint1-codemode/prompt_contract.spec.ts: module loads and exposes expected function names.

Accept when
- Modules compile; exports exist; tests pass.

Process
- Implement → write tests → run tests → fix until green → push to Orchestrator-CodeMode-Merge.

Status: Completed – 2025-10-31
