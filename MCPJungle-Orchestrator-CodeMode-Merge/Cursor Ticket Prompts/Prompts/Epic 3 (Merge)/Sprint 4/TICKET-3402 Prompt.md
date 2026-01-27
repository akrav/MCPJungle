### Cursor Prompt: Execute Ticket TICKET-3402

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3402
- TICKET_NAME: Ticket-3402 — Metrics: compile/eval histograms, tool-call and error counters
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 4/Ticket-3402.md

Permanent references:
- OTel helpers: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/obs/otel.ts

Code references for this ticket:
- Telemetry: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/codemode/telemetry.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint4-obs/metrics_counters_histograms.spec.ts

Objective:
- Emit histograms for compile/eval and counters for tool_calls_total, codemode_errors_total(kind).

Required steps:
1) Implement metric helper functions and wire in runner/invoker.
2) Add tests asserting increments/records.

Success criteria:
- Metrics recorded with expected labels; tests pass.
