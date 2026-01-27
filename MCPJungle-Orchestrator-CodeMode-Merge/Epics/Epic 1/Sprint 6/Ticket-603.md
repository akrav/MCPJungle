## Ticket-603 — JWT parse & session guard (admin only)

**Why**
Gate admin via **JWT**; attach claims (`sub`, `roles`) to ctx. ([JWT claims guidance])

**Where**
`/admin/src/auth/jwt.ts`, wire in `trpc/context.ts`

**Implementation sketch**

* Verify signature (dev secret); extract `sub`, `roles: admin|viewer`; add `ctx.user`.

**Tests**
`jwt_parse.spec.ts`: no/invalid token → 401; valid with role → ok.

**Accept when**
Only authenticated requests pass.

**LLM priming**
`Authorization: Bearer`, `JWT verify`, `roles claim`, `ctx.user`.

---
