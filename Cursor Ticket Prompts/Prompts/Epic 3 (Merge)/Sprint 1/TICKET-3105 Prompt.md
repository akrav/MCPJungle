### Cursor Prompt: Execute Ticket TICKET-3105

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3105
- TICKET_NAME: Ticket-3105 — Jungle tool fetch (smoke; reuse MCPClient)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 1/Ticket-3105.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Reuse MCP client: /Users/adam/Documents/GitHub/MCPJungle/codemode-standalone/src/mcp/MCPClient.ts
- Orchestrator facade: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/index.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint1-codemode/mcp_client_listtools_smoke.spec.ts

Objective:
- Fetch tools from the user’s Jungle via SSE as a smoke test; prefer mocks in CI.

Required steps:
1) Wire MCPClient in index.ts; retrieve tools list.
2) Add a guarded smoke test (env-flagged for real Jungle).
3) Run tests: `npm run test -- tests/sprint1-codemode/mcp_client_listtools_smoke.spec.ts`.

Success criteria:
- Smoke test passes locally/mock; no throws; logs names; CI remains green.
