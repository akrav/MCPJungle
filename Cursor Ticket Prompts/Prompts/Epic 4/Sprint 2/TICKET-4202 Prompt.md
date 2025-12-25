### Cursor Prompt: Execute Ticket TICKET-4202

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4202
- TICKET_NAME: Ticket-4202 — Ranking Strategies (Cost/Rating)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 2/Ticket-4202.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 2 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 2/Sprint 2 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/selection/ranking.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-2/ranking.spec.ts

Objective:
- Implement `rankTools` supporting 'cheapest', 'rating', and 'balanced' strategies.

Constraints and style:
- Balanced strategy uses weighted formula: `(Rating * 10) - (Price * 1000)`.

Required steps:
1) Read the ticket.
2) Implement ranking logic for all 3 strategies.
3) Write unit tests verifying sort order.
4) Run tests.

Output:
- Test execution results.

