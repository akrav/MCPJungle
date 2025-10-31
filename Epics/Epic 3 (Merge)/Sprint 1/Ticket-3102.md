# Ticket-3102 — Type generation wiring (reuse TypeGenerator)

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3102 — Type generation wiring (reuse TypeGenerator)")

What / Why
- Use codemode-standalone’s TypeGenerator to convert MCPJungle tool schemas to a typed `declare const codemode` surface with canonical names.

Where
- /orchestrator/src/codemode/typegen.ts

Implementation sketch
- Accept tool descriptors fetched via Jungle (MCP tools/list).
- Canonicalize names to server__tool.
- Call TypeGenerator.generateTypeDefinitions(tools) and return { dts, names }.

Tests
- tests/sprint1-codemode/typegen_namespacing.spec.ts: output has canonical names; no duplicates; single ambient declaration.

Accept when
- Output contains canonical names and one `declare const codemode` block.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.

Status: Completed – 2025-10-31
