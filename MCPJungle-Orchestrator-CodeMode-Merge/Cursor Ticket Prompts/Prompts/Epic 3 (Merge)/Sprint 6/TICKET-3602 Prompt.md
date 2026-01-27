### Cursor Prompt: Execute Ticket TICKET-3602

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3602
- TICKET_NAME: Ticket-3602 — Docker provisioner (local dev)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3602.md

Permanent references:
- Provisioning: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning/docker.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/docker_command_build.spec.ts

Objective:
- Build docker run/inspect/stop command composition and parse inspect JSON to compute baseUrl (no live Docker).

Required steps:
1) Implement command strings and parsing helpers.
2) Add unit tests validating composition and parsing.

Success criteria:
- Deterministic commands/parsing; tests pass without Docker.
