### Cursor Prompt: Execute Ticket TICKET-3701

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3701
- TICKET_NAME: Ticket-3701 — Soak: many short Code Mode runs (stub Jungle)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3701.md

Permanent references:
- Runner/Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/soak_codemode_short.spec.ts

Objective:
- Run many short Code Mode executions with a stub Jungle; record p50/p95 and success rate.

Required steps:
1) Implement soak with limited concurrency; collect timings; assert thresholds.

Success criteria:
- Soak passes locally/CI; brief summary printed.
