# Sprint 6 — Admin Plane (MVP) — Updated & Sequential

**Theme**
Lightweight, read-mostly **admin web UI** (Next.js App Router + tRPC + Zod + shadcn/ui + TanStack Table). Security: **JWT** gate, **RBAC** (Admin/Viewer), **CSRF** on mutations, **no PII in logs**, clear **audit** entries. Pages: Instances, Requests, Tools (read-only probe). 

**What changed (merges)**

* **601 + 602 → 601** (bootstrap + UI shell)
* **610 + 612 → 609** (tiny mutation + CSRF/RBAC + audit)

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix → **commit & push**. Keep tickets 10–30 minutes.

**Repo additions** (paths preserved; names adjusted for merges)

```
/admin
  /app
    layout.tsx
    page.tsx
    /instances/page.tsx
    /requests/page.tsx
    /tools/page.tsx
    /api/trpc/[trpc]/route.ts
  /src
    trpc/router.ts
    trpc/context.ts
    auth/jwt.ts
    auth/rbac.ts
    csrf/token.ts
    ui/columns.tsx
    lib/fetchOrch.ts
    lib/audit.ts
  /tests/sprint6
    next_bootstrap.spec.ts
    trpc_router_health.spec.ts
    jwt_parse.spec.ts
    rbac_guard.spec.ts
    csrf_guard.spec.ts
    instances_table.spec.tsx
    requests_table.spec.tsx
    tools_list_probe.spec.ts
    audit_log_write.spec.ts      # used by Ticket-609
    readme_admin_quickstart.spec.ts
  next.config.js
  package.json
  tailwind.config.ts
  postcss.config.js
  .env.example
```

---

## Ticket-601 — Next.js (App Router) bootstrap **+ shadcn/ui shell**  *(merged)*

**Why**
Stand up the app and a clean shell (sidebar/header) so other pages drop in fast. ([Next.js App Router], [shadcn/ui]) 

**Where**
`/admin/app/layout.tsx`, `/admin/app/page.tsx`, `next.config.js`, Tailwind configs; shell scaffolding in `layout.tsx` + simple nav.

**Implementation sketch**

* `npx create-next-app@latest admin --ts` (or manual in `/admin`).
* Add Tailwind + shadcn/ui; import Button, Card, Table styles.
* Add sidebar links: **Instances**, **Requests**, **Tools**.

**Tests**
`next_bootstrap.spec.ts`: build or start dev; assert “Admin” heading and nav links render.

**Accept when**
App compiles; nav shows **Instances/Requests/Tools**.

**LLM priming**
`Next.js App Router`, `layout.tsx`, `page.tsx`, `Tailwind setup`, `shadcn/ui Card/Button`, `npm run dev`.

---

## Ticket-602 — tRPC + Zod wiring (API layer)

**Why**
Type-safe server actions with input validation. ([tRPC], [Zod])

**Where**
`/admin/src/trpc/{router.ts,context.ts}`, `/admin/app/api/trpc/[trpc]/route.ts`

**Implementation sketch**

* Add `health` query that pings orchestrator `/healthz` via `fetchOrch`.

**Tests**
`trpc_router_health.spec.ts`: `health()` → `{ ok: true }`.

**Accept when**
tRPC endpoint responds through Next route handler.

**LLM priming**
`t.router`, `procedure.query`, `z.object`, `Next.js route handler`.

---

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

## Ticket-604 — RBAC guard (Admin / Viewer)

**Why**
`viewer` = read; `admin` = mutate. ([NIST RBAC])

**Where**
`/admin/src/auth/rbac.ts`

**Implementation sketch**

* Helpers: `requireRole('viewer')`, `requireRole('admin')` as tRPC middleware.

**Tests**
`rbac_guard.spec.ts`: viewer blocked on mutate; admin allowed.

**Accept when**
Role checks behave as expected.

**LLM priming**
`RBAC`, `role→permission`, `tRPC middleware`.

---

## Ticket-605 — CSRF token for mutations

**Why**
CSRF guard even behind JWT (Synchronizer Token Pattern). ([OWASP CSRF])

**Where**
`/admin/src/csrf/token.ts`; inject token in forms or tRPC headers.

**Implementation sketch**

* Per-session token; require header `x-csrf-token` on mutations; verify server-side.

**Tests**
`csrf_guard.spec.ts`: missing token → 403; present token → 200.

**Accept when**
Mutations require a valid token.

**LLM priming**
`x-csrf-token`, `Synchronizer Token`.

---

## Ticket-606 — Instances page (read-only)

**Why**
View per-user Jungle instances (id, userId, status, lastSeen). ([TanStack Table])

**Where**
`/admin/app/instances/page.tsx`, `/admin/src/ui/columns.tsx`, `fetchOrch.listInstances()`

**Implementation sketch**

* Render table with sorting (lastSeen) + quick filter (userId).

**Tests**
`instances_table.spec.tsx`: rows render; sorting & filtering work.

**Accept when**
Table renders, sorts, filters.

**LLM priming**
`useReactTable`, `columns`, `sorting`, `columnFilters`.

---

## Ticket-607 — Requests page (recent /mcp calls)

**Why**
Observe recent calls (method, duration, status) with **no PII**; link to trace/span if available. ([OWASP Logging])

**Where**
`/admin/app/requests/page.tsx`, `fetchOrch.listRecentRequests()`

**Implementation sketch**

* Table of sanitized entries; optional traceId link.

**Tests**
`requests_table.spec.tsx`: required columns present; no sensitive fields.

**Accept when**
Sanitized table renders.

**LLM priming**
`structured logging`, `trace_id`, `no PII`.

---

## Ticket-608 — Tools page (read-only probe via tRPC)

**Why**
Run a **`tools/list`** probe through orchestrator → Jungle; render tools.

**Where**
`/admin/app/tools/page.tsx`, `trpc/router.ts` (`toolsList`), `fetchOrch.mcp({ method:'tools/list' })`

**Implementation sketch**

* Query via tRPC; show tool id/name/description.

**Tests**
`tools_list_probe.spec.ts`: mock JSON; assert render & empty state.

**Accept when**
Probe returns and renders cleanly.

**LLM priming**
`JSON-RPC`, `tools/list`, `Zod schema`, `tRPC procedure`.

---

## Ticket-609 — Minimal mutation **with CSRF + RBAC enforced** **and audit event**  *(merged)*

**Why**
One tiny write to prove the full security path **and** generate an **audit** entry. ([OWASP Logging Vocabulary])

**Where**
`tRPC router` (mutation), `csrf/token.ts`, `rbac.ts`, `lib/audit.ts`

**Implementation sketch**

* Mutation: e.g., “mark instance note” or “request refresh”.
* Requires `admin` + `x-csrf-token`; emits `AuditEvent { ts, actorSub, action, subject, details }`.

**Tests**

* Update `csrf_guard.spec.ts` & `rbac_guard.spec.ts` to require both.
* `audit_log_write.spec.ts`: event is appended with required fields.

**Accept when**
Without either guard → failure; with both → success; audit written.

**LLM priming**
`tRPC mutation`, `requireRole('admin')`, `x-csrf-token`, `append-only audit`.

---

## Ticket-610 — Admin README: Quickstart & security notes

**Why**
Copy-pasteable run book for the admin with security bullets.

**Where**
`/admin/README.md`, `.env.example`

**Implementation sketch**

* Steps to run against orchestrator & Jungle: `ORCH_URL`, `ADMIN_JWT_SECRET`.
* Sections: JWT, RBAC roles, CSRF tokens, **no PII in logs**; link to pages/tests.

**Tests**
`readme_admin_quickstart.spec.ts`: grep README for each section and filenames.

**Accept when**
Doc is present, accurate, and actionable.

**LLM priming**
`ENV VARS`, `Next.js dev`, `JWT secret`, `RBAC`, `CSRF`, `OWASP`.

---

## How to run Sprint 6 locally

```bash
# Orchestrator should already be running from prior sprints (ORCH_URL set)

# Admin app
cd admin
npm i
npm run dev

# Run only Sprint 6 tests
npm run test -- tests/sprint6
```

---

### Why these priming cues work

They point the model at **idiomatic** API names and shapes from the referenced stack—**Next.js App Router**, **shadcn/ui**, **TanStack Table**, **tRPC + Zod**, **JWT/RBAC/CSRF**, and **OWASP logging**—so outputs are secure, TypeScript-first, and easy to verify with the provided tests. 

If you want, I can also drop a tiny file skeleton for each ticket (headers + TODOs + example asserts) so multiple tickets go green with minimal extra calls.
