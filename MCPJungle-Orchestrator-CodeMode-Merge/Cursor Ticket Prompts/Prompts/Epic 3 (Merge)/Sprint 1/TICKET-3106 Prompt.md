### Cursor Prompt: Execute Ticket TICKET-3106

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3106
- TICKET_NAME: Ticket-3106 — Wire typed surface facade
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 1/Ticket-3106.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Facade implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/index.ts
- Cache integration: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/cache.ts
- TypeGen reuse: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/typegen.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint1-codemode/typegen_hashing.spec.ts

Objective:
- Expose getTypedSurface({ userId }) combining config, list tools, type generation, and caching; return { dts, hash }.

Required steps:
1) Implement facade composition calling TypeGenerator + cache.
2) Extend tests to validate cache path via index.ts.
3) Run tests: `npm run test -- tests/sprint1-codemode/typegen_hashing.spec.ts`.

Success criteria:
- Facade returns stable { dts, hash }; uses cache for identical catalogs; tests pass.
