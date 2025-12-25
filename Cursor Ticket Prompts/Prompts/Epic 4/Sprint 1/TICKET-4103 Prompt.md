### Cursor Prompt: Execute Ticket TICKET-4103

Please execute this ticket for Epic 4: Dynamic Tool Discovery.

Ticket to execute:
- TICKET_ID: 4103
- TICKET_NAME: Ticket-4103 — Supabase Vector Search (RPC)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Ticket-4103.md

Permanent references (always follow):
- Epic 4 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Epic 4 Overview.md
- Sprint 1 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 4/Sprint 1/Sprint 1 Overview.md

Code references for this ticket:
- Create: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/discovery/search/vectorStore.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-1/vectorStore.spec.ts

Objective:
- Implement `findSimilarTools` which calls the `match_tools` RPC function on Supabase.

Constraints and style:
- Use Supabase client `rpc` method. Map results to `Tool` objects.

Required steps:
1) Read the ticket.
2) Implement vector search wrapper.
3) Write unit tests (mocking Supabase RPC).
4) Run tests.

Output:
- Test execution results.

