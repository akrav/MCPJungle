### Cursor Prompt: Execute Ticket TICKET-3702

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3702
- TICKET_NAME: Ticket-3702 — Chaos: restart Jungle mid-run (error hygiene)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3702.md

Permanent references:
- Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/invoker.ts

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/chaos_restart_jungle.spec.ts

Objective:
- Simulate mid-stream upstream error/restart; ensure deterministic error mapping and clean termination.

Required steps:
1) Implement test stub closing mid-stream or returning 502; assert mapping and single terminal event.

Success criteria:
- Proper mapping; no hangs/double-finalization; tests pass.
