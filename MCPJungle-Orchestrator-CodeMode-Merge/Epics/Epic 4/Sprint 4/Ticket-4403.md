# Ticket-4403 — Admin Route Skeleton

**What / Why**
Set up the Express route for the Admin API, including input validation and basic 400/404 handling. This creates the "shell" for the manual selection feature.

**Where**
`/src/server/admin.ts`

**Implementation Sketch**
*   Create `/src/server/admin.ts` (if not exists).
*   Define Zod schema for payload: `{ requestId: uuid, toolId: uuid (optional), action: 'select'|'reject' }`.
*   Add Route `POST /admin/select-tool`.
*   **Logic**:
    *   Validate Body. If invalid -> 400.
    *   Check `getPendingChoices(requestId)`. If missing -> 404.
    *   Return 200 "OK" (Stub).

**Tests**
`/tests/sprint4-4/admin_route.spec.ts`:
*   **Test**: Call with valid body -> 200.
*   **Test**: Call with missing requestId -> 400.
*   **Test**: Call with unknown requestId -> 404.

**Accept When**
The endpoint exists and correctly validates inputs.

**LLM Priming (keywords/APIs)**
`Express Router`, `Zod Validation`, `HTTP Status Codes`

