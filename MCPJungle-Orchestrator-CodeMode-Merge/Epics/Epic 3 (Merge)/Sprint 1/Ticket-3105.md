# Ticket-3105 — Jungle tool fetch (smoke; reuse MCPClient)

Source: Epics/Epic 3 (Merge)/Sprint 1/Sprint 1 Overview.md (section "Ticket-3105 — Jungle tool fetch (smoke; reuse MCPClient)")

What / Why
- Fetch tools for the current user from Jungle using MCPClient (SSE) to feed the generator. Keep as a smoke test in CI (mock or docker profile).

Where
- /orchestrator/src/codemode/index.ts (integration)
- /tests/sprint1-codemode/mcp_client_listtools_smoke.spec.ts

Implementation sketch
- Use loadConfig → MCPClient({ url, transport:"sse" }) → connect() → getTools().
- Prefer mocks in tests; optional docker profile job for real Jungle.

Tests
- Guarded by env; asserts tools array length ≥ 0 without throw; logs a couple names.

Accept when
- Smoke passes locally/dev; test suite green using mock by default.

Process
- Implement → write tests → run tests → fix → push to Orchestrator-CodeMode-Merge.

Status: Completed – 2025-10-31
