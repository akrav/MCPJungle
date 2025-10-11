## Ticket-005 — HTTP server + `/healthz`

**What / Why**
Express server exposing `GET /healthz` for liveness & quick diagnostics.

**Where**
`/src/server/http.ts`, `/src/health/healthz.ts`

**Implementation sketch**
Use **Express**; `GET /healthz` → `{ ok: true, version, jungleUrl }`. ([expressjs.com][3])

**Tests**
`/tests/sprint0/healthz.spec.ts` using **Supertest**: expect 200 JSON. ([npm][6])

**Accept when**
Health returns 200 with required fields.

**Plain English**

> Prove it’s running and show the Jungle URL it will call.

**LLM priming**
`express()`, `app.get('/healthz')`, `supertest request(app)`, `toHaveProperty`

---
