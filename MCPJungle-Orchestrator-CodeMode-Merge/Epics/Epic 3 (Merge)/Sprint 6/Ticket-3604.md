# Ticket-3604 — Router: ensure endpoint on miss (feature-gated)

Source: Epics/Epic 3 (Merge)/Sprint 6/Sprint 6 Overview.md (section "Ticket-3604 — Router: ensure endpoint on miss (feature-gated)")

What / Why
- When ROUTING_MODE=per_user and PROVISION_ON_DEMAND=true, provision a Jungle for a user with no mapping, then store and return it.

Where
- /orchestrator/src/routing/router.ts

Implementation sketch
- ensureEndpoint(userId): consult store; on miss & flag, call provisioner → health → store.set(userId, baseUrl, ttl); return { baseUrl, mode:'per_user' }.
- log('info','route_provisioned',{ user_id, baseUrl }).

Tests
- tests/sprint6-provisioning/router_ensure_on_miss.spec.ts: mock provisioner + health; verify store set and baseUrl returned.

Accept when
- Auto-provision path engaged only with feature flag; else unchanged.

Process
- Implement → write tests → run → fix → push.
