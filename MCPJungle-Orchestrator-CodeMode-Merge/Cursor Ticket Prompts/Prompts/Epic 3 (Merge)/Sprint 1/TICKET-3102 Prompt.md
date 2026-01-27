### Cursor Prompt: Execute Ticket TICKET-3102

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3102
- TICKET_NAME: Ticket-3102 — Type generation wiring (reuse TypeGenerator)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 1/Ticket-3102.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Codemode TypeGenerator (reuse): /Users/adam/Documents/GitHub/MCPJungle/codemode-standalone/src/core/TypeGenerator.ts
- MCP types (reuse): /Users/adam/Documents/GitHub/MCPJungle/codemode-standalone/src/types/index.ts
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/typegen.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint1-codemode/typegen_namespacing.spec.ts

Environment and secrets:
- None required for this ticket.

Objective:
- Wire TypeGenerator into orchestrator codemode/typegen.ts to emit the ambient `declare const codemode` surface using canonical `server__tool` names.

Constraints and style:
- Follow canonical naming and keep a single ambient declaration. No code execution in this ticket.

Required steps:
1) Read the ticket spec and Epic overview.
2) Implement typegen.ts using the standalone TypeGenerator.
3) Add/adjust tests to validate canonical names and single declaration.
4) Run tests: `npm i && npm run test -- tests/sprint1-codemode/typegen_namespacing.spec.ts`.

Output:
- Status of implementation; files touched; test results.

Success criteria:
- Type generation produces canonical `server__tool` names and a single `declare const codemode` block; tests pass.
