# Ticket-4503 — Edge Case: No Matches Found

**What / Why**
Ensure the system behaves gracefully when Supabase has no relevant tools (or all are filtered out by safety caps). The agent should receive a clear error, not hang or crash.

**Where**
`/tests/sprint4-5/edge_cases.spec.ts`

**Implementation Sketch**
*   **Scenario A (Empty DB)**:
    *   Mock Supabase vector search to return `[]`.
    *   Send request.
    *   Assert: Orchestrator returns final error (404/MethodNotFound). No discovery loop.
*   **Scenario B (Safety Filter)**:
    *   Mock Supabase returning 1 tool: Cost $100.
    *   Mock User Prefs: Max Cap $0.01.
    *   Send request.
    *   Assert: Tool is filtered out. Orchestrator returns final error.

**Tests**
`npm run test -- tests/sprint4-5/edge_cases.spec.ts`

**Accept When**
System correctly identifies "nothing to install" and gives up gracefully.

**LLM Priming (keywords/APIs)**
`Negative Testing`, `Edge Case Analysis`, `Error Boundaries`

