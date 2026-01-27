# Sprint 4 — Manual Mode & Interaction

**Goal**
Implement the "Human-in-the-loop" flow for cases where the user wants to manually select from options. This is critical for cost control and user trust.

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 4)**
```
/orchestrator
  /src
    /discovery
      /interaction
        prompt.ts               # CLI / User Prompt Logic
        pendingState.ts         # Stores choices while waiting for user input
        index.ts                # Interaction Service Facade
  /tests
    /sprint4-4
      prompt.spec.ts
      pendingState.spec.ts
      manualFlow.spec.ts
```

---

## Ticket-4401 — Pending Choice State Manager

**What / Why**
When the system pauses for manual input, we need to temporarily store the list of candidate tools so we can present them to the user and handle their selection later.

**Where**
`/src/discovery/interaction/pendingState.ts`

**Implementation Sketch**
*   Create a simple in-memory store (Map) keyed by `requestId` or `userId`.
*   Export `storePendingChoices(id, candidates: Tool[])`.
*   Export `getPendingChoices(id)`.
*   Export `clearPendingChoices(id)`.

**Tests**
`/tests/sprint4-4/pendingState.spec.ts`

**Accept When**
We can reliably hold state across the async pause.

**LLM Priming**
`State Management`, `Ephemeral Store`, `Session State`

---

## Ticket-4402 — User Prompt Interface (CLI/Log)

**What / Why**
For the MVP, we need a way to "ask" the user. Since this is an MCP server, we might not have a direct UI. We will output a structured log or specific "Approval Request" error that a client *could* interpret, or simply log to the console for a CLI admin to see.

**Where**
`/src/discovery/interaction/prompt.ts`

**Implementation Sketch**
*   Export `requestUserSelection(candidates: Tool[])`.
*   Format the candidates into a readable table (Name, Price, Rating).
*   Log this table to `stderr` or a special `discovery-events` log channel.

**Tests**
`/tests/sprint4-4/prompt.spec.ts`

**Accept When**
The system outputs a clear, readable list of options when manual mode triggers.

**LLM Priming**
`CLI Table`, `User Interaction`, `Formatted Output`

---

## Ticket-4403 — Admin Route Skeleton

**What / Why**
Set up the Express route for the Admin API, including input validation and basic 400/404 handling.

**Where**
`/src/server/admin.ts`

**Implementation Sketch**
*   Create `/src/server/admin.ts` (if not exists).
*   Define Zod schema for payload: `{ requestId: uuid, toolId: uuid (optional), action: 'select'|'reject' }`.
*   Add Route `POST /admin/select-tool`.

**Tests**
`/tests/sprint4-4/admin_route.spec.ts`

**Accept When**
The endpoint exists and correctly validates inputs.

**LLM Priming**
`Express Router`, `Zod Validation`

---

## Ticket-4404 — Manual Selection Logic

**What / Why**
Implement the business logic inside the Admin Route: actually installing the tool or clearing the pending state based on the user's action.

**Where**
`/src/server/admin.ts`

**Implementation Sketch**
*   Update the route from Ticket-4403.
*   **Action = 'reject'**: Call `clearPendingChoices`.
*   **Action = 'select'**: Call `installTool` (Sprint 3) and `clearPendingChoices`.

**Tests**
`/tests/sprint4-4/admin_logic.spec.ts`

**Accept When**
The API correctly executes the user's decision.

**LLM Priming**
`Controller Logic`, `Business Logic`

---

## Ticket-4405 — Manual Mode Wiring

**What / Why**
Update the main Discovery logic (from Sprint 3) to handle the `mode === 'manual'` case using the new Interaction components.

**Where**
`/src/discovery/index.ts`

**Implementation Sketch**
*   Update `resolveMissingTool`.
*   If `selection.mode === 'manual'`:
    *   Call `storePendingChoices`.
    *   Call `requestUserSelection`.
    *   Throw/Return a specific error: "Manual selection required. Check logs/admin."
    *   (Do NOT auto-install).

**Tests**
`/tests/sprint4-4/manualFlow.spec.ts`

**Accept When**
Manual mode stops the flow and waits (persists state), instead of auto-installing.

**LLM Priming**
`Control Flow`, `State Machine`, `Async Workflow`
