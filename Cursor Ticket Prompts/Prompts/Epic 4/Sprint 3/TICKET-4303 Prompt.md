### Cursor Prompt: Execute Ticket TICKET-4303

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4303
- TICKET_NAME: Ticket-4303 — Discovery Interceptor (Middleware)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Ticket-4303.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 3/Sprint 3 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/interceptor.ts
- Edit: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/server/router.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-3/interceptor.spec.ts

Objective:
- Implement `handleToolNotFound` middleware to catch 404s and trigger `DiscoveryService.resolveMissingTool`.

Constraints and style:
- Graceful degradation: if discovery fails, pass original error.

Required steps:
1) Read the ticket.
2) Implement middleware logic.
3) Write unit tests (mocking discovery service).
4) Run tests.

Output:
- Test execution results.

