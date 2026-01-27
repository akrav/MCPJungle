### Cursor Prompt: Execute Ticket TICKET-4203

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4203
- TICKET_NAME: Ticket-4203 — Selection Service Facade
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 2/Ticket-4203.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 2 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 2/Sprint 2 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/selection/index.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/selection/filters.ts
- Import: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/selection/ranking.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-2/selectionService.spec.ts

Objective:
- Implement `selectBestTool` which orchestrates filtering, ranking, and the auto-selection decision based on `discoveryMode`.

Constraints and style:
- Facade pattern. Returns `candidates` list and optional `autoSelected` tool.

Required steps:
1) Read the ticket.
2) Implement facade logic.
3) Write unit tests covering Auto vs Manual mode outcomes.
4) Run tests.

Output:
- Test execution results.

