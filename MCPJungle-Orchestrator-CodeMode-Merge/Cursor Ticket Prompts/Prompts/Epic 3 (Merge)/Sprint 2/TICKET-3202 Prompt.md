### Cursor Prompt: Execute Ticket TICKET-3202

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3202
- TICKET_NAME: Ticket-3202 — codemode binding Proxy → invoker hook
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3202.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/binding.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/binding_proxy_forward.spec.ts

Objective:
- Implement Proxy that forwards codemode["name"](args) to invoker(fn, args), rejecting non-string props.

Required steps:
1) Implement binding.ts `createCodemodeBinding`.
2) Add tests verifying forward and error path.
3) Run: `npm run test -- tests/sprint2-codemode/binding_proxy_forward.spec.ts`.

Success criteria:
- Forwarding works; non-string props error; tests pass.
