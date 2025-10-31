# Ticket-3106 — Wire typed surface facade

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3106 — Wire typed surface facade")

What / Why
- Add the public function that ties it together: getTypedSurface({ userId }) → fetch tools (via Jungle), generate typings, cache by (userId,catalogHash), and return { dts, hash }.

Where
- /orchestrator/src/codemode/index.ts

Implementation sketch
- Compose: load config → fetch tools → TypeGenerator → cache.getOrCreate(userId,hash).
- No HTTP endpoint yet (lands next sprint); pure function for now.

Tests
- Extend typegen_hashing.spec.ts to verify cache engaged via index.ts and returns stable { dts, hash }.

Accept when
- Single call returns { dts, hash }; repeated call with same catalog uses cache; schema mutation changes hash.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.

Status: Completed – 2025-10-31
