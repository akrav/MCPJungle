**Theme:** **Admin Plane (MVP)** — lightweight, read-mostly web UI to observe and operate your pass-through orchestrator (per-user Jungle instances, requests stream, basic RBAC, audit trail). Built as a separate **Next.js (App Router) + tRPC + Zod** app, using **shadcn/ui** + **TanStack Table** for fast, accessible UIs. Security: **JWT Bearer** to enter the admin, **RBAC** (Admin/Viewer), **CSRF** for mutations, **no PII in logs**, and clear audit entries.
References we align to: **Next.js App Router** docs, **shadcn/ui**, **TanStack Table**, **tRPC** + Zod, **RBAC** (NIST), **JWT/claims** guidance, **OWASP** Logging & CSRF. ([Next.js][1])

---

# Sprint 6 — Admin Plane (MVP)

**Goal**
Ship a small **admin web UI** that lets you: (1) log in (JWT), (2) see **per-user Jungle** instances, (3) tail recent **/mcp** requests/responses (summaries), (4) run a read-only **tools/list** probe, (5) view **audit log** entries. Security: **RBAC (Admin/Viewer)**, **CSRF** for mutations, **no sensitive data** in logs.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo additions**

```
/admin
  /app                      # Next.js (App Router)
    layout.tsx
    page.tsx
    /instances/page.tsx
    /requests/page.tsx
    /tools/page.tsx
    /api/trpc/[trpc]/route.ts      # tRPC handler
  /src
    trpc/router.ts
    trpc/context.ts
    auth/jwt.ts
    auth/rbac.ts
    csrf/token.ts
    ui/columns.tsx                  # TanStack Table column defs
    lib/fetchOrch.ts                # calls orchestrator (/healthz, /mcp)
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
    audit_log_write.spec.ts
    readme_admin_quickstart.spec.ts
  next.config.js
  package.json
  tailwind.config.ts
  postcss.config.js
  .env.example
```

---

## Ticket-601 — Next.js (App Router) bootstrap + Tailwind

**What / Why**
Create a minimal **Next.js (App Router)** app with Tailwind and a landing page. App Router is the current recommended router. ([Next.js][1])

**Where**
`/admin/app/layout.tsx`, `/admin/app/page.tsx`, `next.config.js`, Tailwind config files.

**Implementation sketch**

* `npx create-next-app@latest admin --ts` (or manual setup inside `/admin`).
* Add Tailwind; verify dev server runs.

**Tests**
`/admin/tests/sprint6/next_bootstrap.spec.ts`: start dev server (or run a static render) and assert “Admin” text in HTML.

**Accept when**
App compiles; test finds the landing content.

**Plain English**

> Stand up the admin app and prove it renders.

**LLM priming**
`Next.js App Router`, `layout.tsx`, `page.tsx`, `Tailwind setup`, `npm run dev` ([Next.js][1])

---

## Ticket-602 — shadcn/ui setup & base shell

**What / Why**
Install **shadcn/ui** and add a simple shell (sidebar + header) to host pages. ([Shadcn UI][2])

**Where**
`/admin/app/layout.tsx`, `/admin/src/ui/*`

**Implementation sketch**

* Initialize shadcn; add Button, Card, Table styles; basic navigation scaffold.

**Tests**
`/admin/tests/sprint6/next_bootstrap.spec.ts`: assert nav links exist (“Instances”, “Requests”, “Tools”).

**Accept when**
Shell renders and links appear.

**Plain English**

> Give the admin app a nice, consistent frame.

**LLM priming**
`shadcn/ui`, `Card`, `Button`, `Sheet`, `responsive sidebar` ([Shadcn UI][2])

---

## Ticket-603 — tRPC + Zod wiring (API layer)

**What / Why**
Expose a tiny **tRPC** API in the admin for server actions, with **Zod** input validation. End-to-end type safety. ([trpc.io][3])

**Where**
`/admin/src/trpc/{router.ts,context.ts}`, `/admin/app/api/trpc/[trpc]/route.ts`

**Implementation sketch**

* Add `health` procedure that pings orchestrator `/healthz` via `fetchOrch`.

**Tests**
`/admin/tests/sprint6/trpc_router_health.spec.ts`: call `health` → `{ok:true}`.

**Accept when**
tRPC endpoint responds through Next route handler.

**Plain English**

> Create the admin app’s API with strong TS types.

**LLM priming**
`tRPC router`, `procedure.query`, `z.object`, `Next.js route handler` ([trpc.io][3])

---

## Ticket-604 — JWT parse & session guard (admin only)

**What / Why**
Parse **JWT** from `Authorization: Bearer` or an HttpOnly cookie; attach claims to ctx. Only users with `role:admin|viewer` can enter admin. JWT should carry identity, not arbitrary permissions. ([Permit][4])

**Where**
`/admin/src/auth/jwt.ts`, wire in `trpc/context.ts`

**Implementation sketch**

* Decode (no remote fetch) & verify signature (dev secret).
* Extract `sub`, `roles` claim; add to `ctx.user`.

**Tests**
`/admin/tests/sprint6/jwt_parse.spec.ts`: missing/invalid token → 401; valid token with role → ok.

**Accept when**
Only authenticated requests pass.

**Plain English**

> Check who you are before you can use the admin.

**LLM priming**
`Authorization: Bearer`, `JWT verify`, `roles claim`, `ctx.user` ([Curity][5])

---

## Ticket-605 — RBAC guard (Admin / Viewer)

**What / Why**
Add **RBAC** middleware: `viewer` can read; `admin` can mutate. Follow **NIST RBAC** idea of users↔roles↔permissions. ([NIST Computer Security Resource Center][6])

**Where**
`/admin/src/auth/rbac.ts`

**Implementation sketch**

* `requireRole('viewer')` and `requireRole('admin')` helpers for tRPC procedures.

**Tests**
`/admin/tests/sprint6/rbac_guard.spec.ts`: viewer cannot call mutate; admin can.

**Accept when**
Role checks behave as expected.

**Plain English**

> Decide what a user can do based on their role.

**LLM priming**
`RBAC`, `role → permission`, `NIST RBAC`, `tRPC middleware` ([NIST Computer Security Resource Center][6])

---

## Ticket-606 — CSRF token for mutations (admin UI)

**What / Why**
Protect mutating endpoints with **CSRF token** (Synchronizer Token Pattern). Even though admin is JWT-gated, guard forms/actions. ([OWASP Cheat Sheet Series][7])

**Where**
`/admin/src/csrf/token.ts`, inject token into forms / tRPC headers.

**Implementation sketch**

* Generate per-session token; require header `x-csrf-token` on mutations; verify server-side.

**Tests**
`/admin/tests/sprint6/csrf_guard.spec.ts`: mutation without token → 403; with token → 200.

**Accept when**
Mutations require valid CSRF token.

**Plain English**

> Stop sneaky cross-site clicks from changing admin state.

**LLM priming**
`CSRF token`, `Synchronizer Token`, `x-csrf-token header`, `per-session` ([OWASP Cheat Sheet Series][7])

---

## Ticket-607 — Instances page (read-only)

**What / Why**
Render a **table** of per-user Jungle instances (id, userId, status, lastSeen). Use **TanStack Table** for sorting/filtering. ([TanStack][8])

**Where**
`/admin/app/instances/page.tsx`, `/admin/src/ui/columns.tsx`, `fetchOrch.listInstances()` (mock or adaptor)

**Implementation sketch**

* Call orchestrator (or mock endpoint) to list instances; map to rows; add quick filters.

**Tests**
`/admin/tests/sprint6/instances_table.spec.tsx`: render rows; sort by lastSeen; filter by userId.

**Accept when**
Table renders, sorts, filters.

**Plain English**

> See which Jungle instances exist and if they’re alive.

**LLM priming**
`TanStack Table useReactTable`, `columns`, `sorting`, `columnFilters` ([TanStack][9])

---

## Ticket-608 — Requests page (recent /mcp calls)

**What / Why**
Show a rolling list of recent `/mcp` calls (id, method, status, ms). No payload/PII; follow **OWASP logging** guidance. ([OWASP Cheat Sheet Series][10])

**Where**
`/admin/app/requests/page.tsx`, `fetchOrch.listRecentRequests()`

**Implementation sketch**

* Render a table with method, duration, outcome; link to span/trace id if available.

**Tests**
`/admin/tests/sprint6/requests_table.spec.tsx`: asserts columns & rows; no sensitive fields present.

**Accept when**
Table shows sanitized entries.

**Plain English**

> Watch what’s being called without exposing secrets.

**LLM priming**
`no PII logs`, `trace_id`, `span_id`, `structured logging` ([OWASP Cheat Sheet Series][10])

---

## Ticket-609 — Tools page (read-only probe via tRPC)

**What / Why**
Let admins run a **read-only `tools/list`** probe (calls orchestrator → Jungle) and render results. ([NIST][11])

**Where**
`/admin/app/tools/page.tsx`, `trpc/router.ts` `toolsList` procedure → `fetchOrch.mcp({method:'tools/list'})`

**Implementation sketch**

* Invoke through server action; show tool id, name, description in a table.

**Tests**
`/admin/tests/sprint6/tools_list_probe.spec.ts`: mock JSON; assert rendering & empty state.

**Accept when**
Probe returns and renders cleanly.

**Plain English**

> A quick “what tools does Jungle expose right now?” view.

**LLM priming**
`tools/list`, `JSON-RPC request`, `tRPC procedure`, `Zod schema` ([trpc.io][3])

---

## Ticket-610 — Audit log (append-only) for admin actions

**What / Why**
Write a small **append-only audit** (who/when/what) for admin actions; exclude secrets; normalize terms (OWASP logging vocabulary). ([OWASP Cheat Sheet Series][12])

**Where**
`/admin/src/lib/audit.ts` (in-repo store or DB adapter), call from mutations

**Implementation sketch**

* Define `AuditEvent { ts, actorSub, action, subject, details }`.
* Add a viewer in `Requests` or a simple `/admin/audit` page later.

**Tests**
`/admin/tests/sprint6/audit_log_write.spec.ts`: mutation writes an event; serialized with required fields.

**Accept when**
Events are recorded for each admin mutation.

**Plain English**

> Keep a tamper-evident trail of what admins did.

**LLM priming**
`append-only audit`, `actor`, `action`, `subject`, `OWASP logging` ([OWASP Cheat Sheet Series][10])

---

## Ticket-611 — Admin README: Quickstart & security notes

**What / Why**
Write a **Quickstart** to run the admin against your orchestrator & Jungle; document JWT, RBAC roles, CSRF tokens, and “no PII logs”.

**Where**
`/admin/README.md`, `.env.example`

**Implementation sketch**

* Steps: `npm i`, `npm run dev`, set `ORCH_URL`, `ADMIN_JWT_SECRET`.
* Security bullets with links (RBAC, CSRF, OWASP logging). ([NIST Computer Security Resource Center][6])

**Tests**
`/admin/tests/sprint6/readme_admin_quickstart.spec.ts`: grep README for required sections and links.

**Accept when**
Doc is present, accurate, and copy-pasteable.

**Plain English**

> Make it easy (and safe) for teammates to use the admin.

**LLM priming**
`Next.js dev server`, `ENV VARS`, `JWT secret`, `RBAC`, `CSRF`, `OWASP` ([OWASP Cheat Sheet Series][13])

---

## Ticket-612 — (Guard) Mutation example + CSRF & RBAC enforced

**What / Why**
Add **one minimal mutation** (e.g., “mark instance note” or “trigger list probe refresh”) to prove **RBAC + CSRF** flow works end-to-end.

**Where**
`tRPC router` (mutation), `csrf/token.ts`, `rbac.ts`

**Implementation sketch**

* Mutation requires `admin` + `x-csrf-token`; writes an **audit** entry.

**Tests**

* Update `csrf_guard.spec.ts` & `rbac_guard.spec.ts`: assert both are required; audit entry written.

**Accept when**
Mutation fails without either guard; passes with both.

**Plain English**

> Prove the security wiring with a tiny safe write.

**LLM priming**
`tRPC mutation`, `z.object input`, `requireRole('admin')`, `x-csrf-token` header, `audit event` ([trpc.io][3])

---

## How to run Sprint 6 locally

```bash
# in orchestrator (already running from prior sprints)
# ensure ORCH_URL and JUNGLE_URL are set there

# in /admin
npm i
npm run dev

# run only Sprint 6 tests
npm run test -- tests/sprint6
```

---

### Why these priming cues work

They mirror **exact library/API names and shapes** widely used in strong examples: **Next.js App Router**, **shadcn/ui** components, **TanStack Table** column/row/state patterns, **tRPC** procedures with **Zod** schemas, **JWT** claims for roles (RBAC), and **OWASP** guidance for logging & CSRF. This steers a decoder-only LLM toward **idiomatic, secure, TypeScript-first** implementations for an admin UI over your MCP pass-through. ([Next.js][1])

If you want, I can split these into **per-ticket Markdown files** and pre-scaffold the admin app (with empty tRPC procedures and tests) so several Sprint-6 tickets go green immediately.

[1]: https://nextjs.org/docs/app/getting-started?utm_source=chatgpt.com "App Router: Getting Started"
[2]: https://ui.shadcn.com/docs?utm_source=chatgpt.com "Introduction - shadcn/ui"
[3]: https://trpc.io/docs/quickstart?utm_source=chatgpt.com "Quickstart"
[4]: https://www.permit.io/blog/how-to-use-jwts-for-authorization-best-practices-and-common-mistakes?utm_source=chatgpt.com "How to Use JWTs for Authorization: Best Practices and ..."
[5]: https://curity.io/resources/learn/claims-best-practices/?utm_source=chatgpt.com "Claims Best Practices"
[6]: https://csrc.nist.gov/projects/role-based-access-control?utm_source=chatgpt.com "Role Based Access Control | CSRC"
[7]: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html?utm_source=chatgpt.com "Cross-Site Request Forgery Prevention Cheat Sheet"
[8]: https://tanstack.com/table/latest/docs/introduction?utm_source=chatgpt.com "Introduction | TanStack Table Docs"
[9]: https://tanstack.com/table/latest/docs/framework/react/react-table?utm_source=chatgpt.com "React Table | TanStack Table React Docs"
[10]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html?utm_source=chatgpt.com "Logging - OWASP Cheat Sheet Series"
[11]: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=916402&utm_source=chatgpt.com "The NIST Model for Role Based Access Control"
[12]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html?utm_source=chatgpt.com "Logging Vocabulary - OWASP Cheat Sheet Series"
[13]: https://cheatsheetseries.owasp.org/index.html?utm_source=chatgpt.com "Introduction - OWASP Cheat Sheet Series"
