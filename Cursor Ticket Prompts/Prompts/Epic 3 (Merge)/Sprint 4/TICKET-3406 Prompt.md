### Cursor Prompt: Execute Ticket TICKET-3406

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3406
- TICKET_NAME: Ticket-3406 — E2E observability for a successful Code Mode run
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3406.md

Permanent references:
- Telemetry: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/telemetry.ts
- Runner/Invoker: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode

Code references for this ticket:
- Test: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/e2e_obs_codemode_run.spec.ts

Objective:
- Verify spans, metrics, and logs across a successful Code Mode run calling two tools (stub Jungle).

Required steps:
1) Enable OTEL_TEST=true; run a two-call code path; assert compile/eval spans, tool-call counts, start/end logs.
2) Ensure redaction (no raw code, hash only).

Success criteria:
- All signals present and coherent; tests pass.
