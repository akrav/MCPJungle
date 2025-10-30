### Cursor Prompt: Execute Ticket TICKET-3505

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3505
- TICKET_NAME: Ticket-3505 — Wire router into Code Mode invoker
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3505.md

Permanent references:
- Router: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts

Code references for this ticket:
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts
- Upstream: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/invoker_uses_router.spec.ts

Objective:
- Resolve baseUrl per invoker call using userId and route accordingly.

Required steps:
1) Accept { userId, runId } in invoker context; call router; pass baseUrl to upstream helper.
2) Add tests verifying router calls and baseUrl.

Success criteria:
- Invoker uses router; logs include route decision; tests pass.
