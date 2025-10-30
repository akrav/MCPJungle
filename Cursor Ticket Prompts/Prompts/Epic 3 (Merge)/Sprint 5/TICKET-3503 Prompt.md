### Cursor Prompt: Execute Ticket TICKET-3503

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3503
- TICKET_NAME: Ticket-3503 — In-memory user→endpoint store with TTL (dev stub)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3503.md

Permanent references:
- Routing: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/store.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/store_ttl.spec.ts

Objective:
- Provide a TTL-backed in-memory user→endpoint map with get/set/delete/prune.

Required steps:
1) Implement store with expiresAt; add prune(); configurable TTL.
2) Add tests for set/get/expiry/prune.

Success criteria:
- TTL behavior correct; tests pass.
