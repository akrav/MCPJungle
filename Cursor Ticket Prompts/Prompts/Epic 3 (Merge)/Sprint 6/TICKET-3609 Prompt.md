### Cursor Prompt: Execute Ticket TICKET-3609

Please execute this ticket for Epic 3 (Merge): Orchestrator + Code Mode integration.

Ticket to execute:
- TICKET_ID: 3609
- TICKET_NAME: Ticket-3609 — E2E: two users auto-provisioned and isolated (dev, stub upstream)
- TICKET_FILE: /Users/adam/Documents/GitHub/MCPJungle/Epics/Epic 3 (Merge)/Sprint 6/Ticket-3609.md

Permanent references:
- Router/Provisioning: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/src/{routing,provisioning}

Code references for this ticket:
- Tests: /Users/adam/Documents/GitHub/MCPJungle/orchestrator/tests/sprint6-provisioning/e2e_two_users_isolated_endpoints.spec.ts

Objective:
- With per_user + PROVISION_ON_DEMAND=true, ensure two users get distinct baseUrls and calls are isolated using stub provisioner.

Required steps:
1) Mock Docker provisioner + health to return distinct endpoints; route per user; assert baseUrls and results.

Success criteria:
- E2E passes; logs show route_provisioned for both users.
