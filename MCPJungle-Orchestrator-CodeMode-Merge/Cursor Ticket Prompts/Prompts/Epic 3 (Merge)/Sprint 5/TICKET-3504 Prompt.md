### Cursor Prompt: Execute Ticket TICKET-3504

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3504
- TICKET_NAME: Ticket-3504 — Wire router into /mcp relay
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3504.md

Permanent references:
- Relay: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Router: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Upstream: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/relay_uses_router.spec.ts

Objective:
- Use router-resolved baseUrl for initialize and pass-through in /mcp relay.

Required steps:
1) Extract x-user-id; call resolveJungleEndpoint; substitute baseUrl.
2) Add tests spying router and verifying baseUrl.

Success criteria:
- Relay tests green; router used; tests pass.
