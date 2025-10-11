## Ticket-203 — **Security middleware**: Helmet + JSON size/type guard  *(merged)*

**What / Why**
Add **Helmet** headers and enforce `Content-Type: application/json` with **1 MB** body limit. Keeps inputs sane and streaming safe. 

**Where**
`/src/security/helmet.ts`, `/src/security/limits.ts` (wire in `server/http.ts`)

**Tests**
`security_middleware.spec.ts`:

* `GET /healthz` has `X-Content-Type-Options: nosniff` etc.
* Oversized / wrong content-type → `-32600 InvalidRequest`.

**LLM priming**
`helmet()`, `express.json({limit:'1mb'})`, `req.is('application/json')`.

---
