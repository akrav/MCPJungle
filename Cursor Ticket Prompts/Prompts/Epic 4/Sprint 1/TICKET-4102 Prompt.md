### Cursor Prompt: Execute Ticket TICKET-4102

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4102
- TICKET_NAME: Ticket-4102 — Query Expansion (Ideal Tool Description)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Ticket-4102.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 1 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Sprint 1 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/queryExpansion.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-1/queryExpansion.spec.ts

Objective:
- Implement `expandQuery` using an LLM prompt to generate a rich description of the desired tool from a short user query.

Constraints and style:
- Use OpenAI Chat Completion. Prompt should focus on technical capability description.

Required steps:
1) Read the ticket.
2) Implement expansion logic.
3) Write unit tests (mocking LLM).
4) Run tests.

Output:
- Test execution results.

