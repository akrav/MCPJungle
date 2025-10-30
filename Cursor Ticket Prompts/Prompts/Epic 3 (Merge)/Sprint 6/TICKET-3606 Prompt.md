### Cursor Prompt: Execute Ticket TICKET-3606

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3606
- TICKET_NAME: Ticket-3606 — Metrics & logs for provisioning lifecycle
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3606.md

Permanent references:
- Logger: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/log.ts
- OTel: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/otel.ts

Code references for this ticket:
- Provisioning/router call sites: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/metrics_and_logs.spec.ts

Objective:
- Emit metrics/logs around provision/health/teardown: provision_time_ms, attempts/failures, instances_active, and structured logs.

Required steps:
1) Add counters/histogram/gauge; add structured logs for lifecycle events.
2) Add tests asserting signals and log fields (test exporter).

Success criteria:
- Signals recorded and labeled; logs structured; tests pass.
