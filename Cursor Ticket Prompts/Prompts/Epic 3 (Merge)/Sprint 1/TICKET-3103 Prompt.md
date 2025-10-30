### Cursor Prompt: Execute Ticket TICKET-3103

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3103
- TICKET_NAME: Ticket-3103 — Catalog hash & cache (in-memory)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 1/Ticket-3103.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/cache.ts
- Integrate: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/index.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint1-codemode/typegen_hashing.spec.ts

Objective:
- Compute a stable catalogHash from tool schemas and cache generated typings per (userId,catalogHash) with TTL.

Required steps:
1) Implement cache with sha256 of normalized schemas; TTL-configurable.
2) Integrate with index.ts facade; add tests for stability and cache hits.
3) Run tests: `npm run test -- tests/sprint1-codemode/typegen_hashing.spec.ts`.

Success criteria:
- Stable hash; cache reduces generator calls; tests pass.
