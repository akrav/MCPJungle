## Ticket-210 — CI gate: tests must exercise Bearer

**What / Why**
Add a **hard CI check** so tests don’t bypass Bearer middleware; use a tiny Supertest wrapper that always sets the header in authenticated calls. 

**Where**
`/src/testutils/supertestClient.ts`, `.github/workflows/ci.yml`

**Tests**
`ci_auth_header_gate.spec.ts`: call `/mcp` once **without** header → expected error; with header → OK.

**LLM priming**
`Supertest request(app)`, `set('Authorization','Bearer …')`, `required CI job`.

---
