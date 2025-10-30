### Cursor Prompt: Execute Ticket TICKET-3608

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3608
- TICKET_NAME: Ticket-3608 — K8s provisioner stub (client & unit tests)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3608.md

Permanent references:
- Provisioning: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/provisioning/k8s.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/provisioner_interface.spec.ts

Objective:
- Compose Deployment/Service manifests and compute baseUrl deterministically; unit tests only; runtime methods may throw NotImplemented.

Required steps:
1) Implement pure functions to build manifests and URL.
2) Add unit tests validating manifest fields and URL composition.

Success criteria:
- Type-safe stub; tests pass.
