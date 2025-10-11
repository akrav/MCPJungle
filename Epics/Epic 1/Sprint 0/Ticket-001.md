## Ticket-001 — Repo scaffold & CI smoke

**What / Why**
Initialize TS project and a green CI run to prove the pipeline.

**Where**
`package.json`, `tsconfig.json`, `.github/workflows/ci.yml`

**Implementation sketch**

* Scripts: `build` (tsc), `dev` (tsx src/server/http.ts), `test` (vitest run).
* CI: checkout → setup Node LTS → `npm ci` → `npm run test`. (Standard Node/Express doc baselines.) ([expressjs.com][3])

**Tests**
`/tests/sprint0/repoLayout.spec.ts`: assert key files exist.

**How to run**
`npm i && npm run test`

**Accept when**
CI shows tests passed on PR.

**Plain English**

> Set up Node + TypeScript and make sure CI can run tests.

**LLM priming (keywords/APIs)**
`Node.js LTS`, `TypeScript`, `tsconfig.json`, `Vitest`, `GitHub Actions node`, `npm ci`, `npm run test` ([Vitest][4])

---
