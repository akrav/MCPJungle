### Cursor Prompt: Execute Ticket TICKET-3708

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3708
- TICKET_NAME: Ticket-3708 — CI matrix: include S1–S7 suites with flags
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 7/Ticket-3708.md

Permanent references:
- CI workflow: /Users/adam/Documents/GitHub/MCPJungle/.github/workflows/ci.yml

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint7-hardening/ci_matrix_config.spec.ts

Objective:
- Run sprint-scoped test suites S1–S7 via CI jobs; keep docker/provisioning behind flags; set OTEL_TEST where needed.

Required steps:
1) Update CI to include jobs for tests/sprint*-*; set env flags; skip provisioning unless enabled.
2) Add smoke test parsing YAML to assert presence of jobs/steps.

Success criteria:
- CI workflow updated; test verifies structure; passes locally.
