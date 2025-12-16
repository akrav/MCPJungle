# Ticket-4502 — E2E Test: Manual Mode Happy Path

**What / Why**
Verify the "Human-in-the-loop" works. A user in "Manual Mode" requests a missing tool, the system pauses, the admin API is called, and the system resumes (or is ready to resume). This confirms Sprint 4 integration.

**Where**
`/tests/sprint4-5/e2e_manual_mode.spec.ts`

**Implementation Sketch**
*   **Setup**: Mock Supabase. Set User Prefs to `mode: 'manual'`.
*   **Action 1**: Send request "Get weather".
*   **Assert 1**:
    *   Request returns a specific Error/Signal (e.g. 503 or "Manual Selection Required").
    *   Pending State store contains the candidates.
*   **Action 2**: Simulate Admin API call `POST /admin/select-tool` with the ID of the candidate.
*   **Assert 2**:
    *   `installTool` is called.
    *   Pending State is cleared.

**Tests**
`npm run test -- tests/sprint4-5/e2e_manual_mode.spec.ts`

**Accept When**
The flow works: Request -> Pause -> Admin Select -> Success.

**LLM Priming (keywords/APIs)**
`Asynchronous Testing`, `Stateful Testing`, `Human Interaction Simulation`

