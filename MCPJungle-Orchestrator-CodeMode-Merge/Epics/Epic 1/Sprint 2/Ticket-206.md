## Ticket-206 — **Trace correctness on failures** (error map + timeout)  *(merged)*

**What / Why**
When upstream fails (HTTP 5xx / non-JSON-RPC) or **timeout** occurs, mark span `ERROR`, add `error.type`, `http.status_code`, and return JSON-RPC `-32000`. Also ensure **AbortController** is used and responses end **exactly once**. 

**Where**
`/src/server/proxy.ts`, `/src/server/jungleClient.ts`

**Tests**
`trace_error_and_timeout.spec.ts`:

* Force 502 → span `ERROR` + mapped envelope.
* Force stall → timeout triggers abort; single terminal response.

**LLM priming**
`AbortSignal.timeout(ms)`, `catch AbortError`, `error.data.status`.

---
