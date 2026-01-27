# Ticket-3705 — AuthN/AuthZ sanity (allowlists, BOLA guard)

Source: Epics/Epic 3 (Merge)/Sprint 7/Sprint 7 Overview.md (section "Ticket-3705 — AuthN/AuthZ sanity (allowlists, BOLA guard)")

What / Why
- Validate authentication and authorization: reject missing/invalid bearer tokens; disallow cross-tenant tool access (allowlists/BOLA guard).

Where
- /orchestrator/tests/sprint7-hardening/authn_authz_gates.spec.ts

Implementation sketch
- Requests without token/invalid token → 401/403.
- If allowlist exists (config/mock), disallow server__tool outside list.

Accept when
- Unauthorized blocked; allowlist enforced.

Process
- Implement → run → fix → push.
