### Cursor Prompt: Execute Ticket TICKET-3206

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3206
- TICKET_NAME: Ticket-3206 — Deny ambient APIs (network, fs, timers, crypto)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 2/Ticket-3206.md

Permanent references (always follow):
- Epic 3 Overview: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Epic 3 Overview Draft 1.md

Code references for this ticket:
- Runner/binding configuration: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/runner.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint2-codemode/deny_ambient_apis.spec.ts

Objective:
- Ensure only `codemode` binding is exposed; ambient APIs are unavailable or throw.

Required steps:
1) Harden the evaluation environment to exclude ambient APIs.
2) Add tests verifying errors for fetch/fs/timers/crypto.
3) Run: `npm run test -- tests/sprint2-codemode/deny_ambient_apis.spec.ts`.

Success criteria:
- Ambient API usage is impossible; errors are clear; tests pass.
