### Cursor Prompt: Execute Ticket TICKET-3604

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3604
- TICKET_NAME: Ticket-3604 — Router: ensure endpoint on miss (feature-gated)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3604.md

Permanent references:
- Router/Store: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing

Code references for this ticket:
- Implement: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/routing/router.ts
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/router_ensure_on_miss.spec.ts

Objective:
- When in per_user mode with PROVISION_ON_DEMAND=true, auto-provision Jungle for missing user and store endpoint.

Required steps:
1) Implement ensureEndpoint(userId) → provision → health → store.set → return baseUrl.
2) Add tests mocking provisioner/health.

Success criteria:
- Auto-provision only under feature flag; tests pass.
