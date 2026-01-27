# Ticket-4305 — Retry Mechanism

**What / Why**
After installing the tool, the original user request (e.g., "Get Weather") hasn't been executed yet. We need to re-run it automatically so the user experience is seamless.

**Where**
`/src/server/interceptor.ts`

**Implementation Sketch**
*   Update `handleToolNotFound` in `/src/server/interceptor.ts`.
*   **Logic**:
    *   If `resolveMissingTool` returns `true`:
        *   Check a `retryCount` (to avoid infinite loops). If > 1, throw error.
        *   Call `next()` or re-invoke the router handler with the *same* request object.
        *   Alternatively, return a specific signal code to the client "Retry-After" (but internal retry is better UX).
*   **Recursion Guard**: Pass a flag or counter in `res.locals` or request context to track retries.

**Tests**
`/tests/sprint4-3/interceptor.spec.ts` (update):
*   **Mock** `resolveMissingTool` returns `true`.
*   **Test**: Simulate a request.
*   **Assert**: The request handler logic is executed *twice* (once failed, once retried).
*   **Assert**: If the retry also fails (e.g. tool installed but broken), it eventually errors out (doesn't hang).

**Accept When**
User sends 1 request -> System installs tool -> User gets valid response.

**LLM Priming (keywords/APIs)**
`Request Replay`, `Idempotency`, `Recursion Guard`, `Middleware Loop`

