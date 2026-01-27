# Ticket-4404 — Manual Selection Logic

**What / Why**
Implement the business logic inside the Admin Route: actually installing the tool or clearing the pending state based on the user's action.

**Where**
`/src/server/admin.ts`

**Implementation Sketch**
*   Update the route from Ticket-4403.
*   **Action = 'reject'**:
    *   Call `clearPendingChoices(requestId)`.
    *   Return 200 "Cancelled".
*   **Action = 'select'**:
    *   Find `tool` in pending candidates matching `toolId`.
    *   If not found -> 400 "Invalid Tool ID".
    *   Call `installTool(userId, tool)` (Sprint 3).
    *   Call `clearPendingChoices(requestId)`.
    *   Return 200 "Installed".

**Tests**
`/tests/sprint4-4/admin_logic.spec.ts`:
*   **Mock** Pending State & Installer.
*   **Test Select**: Verify `installTool` is called.
*   **Test Reject**: Verify state is cleared without install.

**Accept When**
The API correctly executes the user's decision.

**LLM Priming (keywords/APIs)**
`Controller Logic`, `Business Logic`, `State Transitions`
