# Ticket-4401 — Pending Choice State Manager

**What / Why**
When the system pauses for manual input, we need to temporarily store the list of candidate tools so we can present them to the user and handle their selection later. This state needs to be keyed by a unique ID (like the Request ID) so we know *which* request is waiting for approval.

**Where**
`/src/discovery/interaction/pendingState.ts`

**Implementation Sketch**
*   Create `/src/discovery/interaction/pendingState.ts`.
*   Define `PendingSelection` interface: `{ requestId: string, userId: string, candidates: Tool[], timestamp: number }`.
*   Implement a singleton store (Map-backed for MVP, Redis later).
*   Export `storePendingChoices(requestId: string, userId: string, candidates: Tool[]): void`.
*   Export `getPendingChoices(requestId: string): PendingSelection | undefined`.
*   Export `clearPendingChoices(requestId: string): void`.
*   (Optional) Add a cleanup interval to remove stale pending choices after N minutes.

**Tests**
`/tests/sprint4-4/pendingState.spec.ts`:
*   **Test Store**: Store a selection -> Get it back -> Assert deep equality.
*   **Test Clear**: Store -> Clear -> Get -> Assert undefined.
*   **Test Isolation**: Store two different request IDs -> Ensure they don't overwrite each other.

**Accept When**
We can reliably hold state across the async pause.

**LLM Priming (keywords/APIs)**
`State Management`, `Ephemeral Store`, `Session State`, `Singleton Pattern`

