### Cursor Prompt: Execute Ticket TICKET-4104

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4104
- TICKET_NAME: Ticket-4104 — Search Service Facade
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Ticket-4104.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 1 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Sprint 1 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/index.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/queryExpansion.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/embedding.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/vectorStore.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-1/searchService.spec.ts

Objective:
- Implement the `searchTools` facade that coordinates Expansion -> Embedding -> Vector Search.

Constraints and style:
- Clean pipeline logic. Error handling if steps fail.

Required steps:
1) Read the ticket.
2) Implement the facade function.
3) Write unit tests (mocking sub-components).
4) Run tests.

Output:
- Test execution results.

