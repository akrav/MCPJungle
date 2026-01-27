# Ticket-4405 — Manual Mode Wiring

**What / Why**
Update the main Discovery logic (from Sprint 3) to strictly handle the `mode === 'manual'` case using the new Interaction components. This ensures that if the user prefers manual control, we **never** auto-install.

**Where**
`/src/discovery/index.ts`

**Implementation Sketch**
*   Update `resolveMissingTool` in `/src/discovery/index.ts`.
*   **Logic update**:
    *   ... (Search & Select happens) ...
    *   If `selection.mode === 'manual'`:
        1.  Call `storePendingChoices(requestId, userId, selection.candidates)`.
        2.  Call `requestUserSelection(requestId, selection.candidates)`.
        3.  Throw a specific error (e.g., `ManualSelectionRequiredError`) or return `false` with a side-effect log.
        4.  (Critical) Ensure `installTool` is **NOT** called.

**Tests**
`/tests/sprint4-4/manualFlow.spec.ts` (Integration):
*   **Mock** Preferences to return 'manual'.
*   **Mock** Search/Select to return candidates.
*   **Test**: Call `resolveMissingTool`.
*   **Assert**: `storePendingChoices` called. `requestUserSelection` called. `installTool` NOT called.
*   **Assert**: Function returns `false` (or throws expected error).

**Accept When**
Manual mode stops the flow, persists state, and notifies the user, instead of auto-installing.

**LLM Priming (keywords/APIs)**
`Control Flow`, `State Machine`, `Async Workflow`, `Guard Clause`

