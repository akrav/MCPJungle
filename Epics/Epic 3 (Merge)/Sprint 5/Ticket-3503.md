# Ticket-3503 — In-memory user→endpoint store with TTL (dev stub)

Source: Epics/Epic 3 (Merge)/Sprint 5/Sprint 5 Overview.md (section "Ticket-3503 — In-memory user→endpoint store with TTL (dev stub)")

What / Why
- Provide store.ts with Map<string,{ baseUrl, expiresAt }> to simulate per-user endpoints until provisioning.

Where
- /orchestrator/src/routing/store.ts

Implementation sketch
- Functions: get(userId), set(userId, baseUrl, ttlMs), delete(userId), prune().
- Default TTL 30 minutes (configurable).

Tests
- tests/sprint5-routing/store_ttl.spec.ts: set→get; after time advance, get undefined; prune removes expired.

Accept when
- TTL behavior correct; no leaks.

Process
- Implement → write tests → run → fix → push.
