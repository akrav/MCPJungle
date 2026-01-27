### Cursor Prompt: Execute Ticket TICKET-3506

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3506
- TICKET_NAME: Ticket-3506 — Header hygiene remains intact after routing
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 5/Ticket-3506.md

Permanent references:
- Relay header contract: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/http.ts

Code references for this ticket:
- Upstream helper: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/upstream.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint5-routing/header_hygiene_after_routing.spec.ts

Objective:
- Ensure header semantics are unchanged when using dynamic endpoints.

Required steps:
1) Verify header shaping code path remains identical.
2) Add tests to assert required headers regardless of baseUrl.

Success criteria:
- Headers match relay behavior; tests pass.
