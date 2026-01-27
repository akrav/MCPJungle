### Cursor Prompt: Execute Ticket TICKET-3203

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3203
- TICKET_NAME: Ticket-3203 — SecurityPolicy wiring (time/memory/output/tool-calls)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3203.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md

Code references for this ticket:
- Reuse policy: /Users/adam/Documents/GitHub/MCPJungle/codemode-standalone/src/execution/SecurityPolicy.ts
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/policy.ts
- Runner integration: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/limits_tool_calls.spec.ts

Objective:
- Enforce caps via SecurityPolicy and expose DEFAULT_SECURITY_POLICY; throw LimitExceeded on breach.

Required steps:
1) Implement policy.ts with defaults and builder.
2) Integrate limits in runner.
3) Run: `npm run test -- tests/sprint2-codemode/limits_tool_calls.spec.ts`.

Success criteria:
- Limits configurable and enforced; tests pass.
