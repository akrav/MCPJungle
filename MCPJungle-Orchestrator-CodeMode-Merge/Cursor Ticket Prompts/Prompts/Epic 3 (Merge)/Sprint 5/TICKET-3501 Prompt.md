### Cursor Prompt: Execute Ticket TICKET-3501

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3501
- TICKET_NAME: Ticket-3501 — Router module contract
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3501.md

Permanent references:
- Config: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/config/{schema.ts,load.ts}

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Store (next ticket): /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/store.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/router_contract.spec.ts

Objective:
- Resolve Jungle endpoint per request: shared default; per_user uses store mapping.

Required steps:
1) Implement resolveJungleEndpoint({ userId }) returning { baseUrl, mode }.
2) Add tests for all cases.

Success criteria:
- Correct resolution for shared/per_user; tests pass.
