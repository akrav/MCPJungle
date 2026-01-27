## Ticket-101 — Env: add Jungle auth and timeouts

**What / Why**
Add `JUNGLE_URL`, **optional** `JUNGLE_TOKEN`, and `ORCH_UPSTREAM_TIMEOUT_MS` (default 30000). Fail fast if `JUNGLE_URL` missing. 

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* Zod schema with `url()`; `timeout` default; token optional.
* Export typed config `{ jungleUrl, jungleToken, upstreamTimeoutMs }`.

**Tests**
`config_pass_through.spec.ts` (table of env cases; missing URL → error; token optional).

**Accept when**
Invalid env yields clear errors; valid env returns typed config.

**LLM priming**
`z.string().url()`, `z.number().default(30000)`, `dotenv`, `process.env`

---
