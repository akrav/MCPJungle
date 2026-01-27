### Cursor Prompt: Execute Ticket TICKET-3205

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3205
- TICKET_NAME: Ticket-3205 — Memory cap enforcement
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3205.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Runner: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Policy: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/policy.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/limits_memory.spec.ts

Objective:
- Prevent pathological memory usage; terminate cleanly with LimitExceeded diagnostics.

Required steps:
1) Enforce memory cap in the runner (via policy/isolated executor options).
2) Add tests allocating large arrays to trigger the cap.
3) Run: `npm run test -- tests/sprint2-codemode/limits_memory.spec.ts`.

Success criteria:
- Memory-limit diagnostics; host remains responsive; tests pass.
