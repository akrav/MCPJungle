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
