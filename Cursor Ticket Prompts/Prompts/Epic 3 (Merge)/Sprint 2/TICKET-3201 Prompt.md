### Cursor Prompt: Execute Ticket TICKET-3201

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3201
- TICKET_NAME: Ticket-3201 — Runner facade (IsolatedExecutor integration)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3201.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md
- Sprint Planning: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint Planning/Sprint Planning.md
- Project Structure: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/structure.md
- Troubleshooting: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Troubleshooting.md
- Sprint Progress: /Users/adam/Documents/GitHub/MCPJungle/Build Documentation/Sprint-Progress.md

Code references for this ticket:
- Reuse executor: /Users/adam/Documents/GitHub/MCPJungle/codemode-standalone/src/execution/IsolatedExecutor.ts
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Binding (next ticket): /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/binding.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/result_envelope.spec.ts

Objective:
- Implement a runner facade around IsolatedExecutor returning { result } or { diagnostics }.

Required steps:
1) Implement runner.ts; map errors to minimal diagnostics.
2) Add tests verifying result envelope.
3) Run: `npm run test -- tests/sprint2-codemode/result_envelope.spec.ts`.

Success criteria:
- Trivial code executes; errors are mapped; tests pass.
