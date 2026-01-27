## Ticket-106 — Timeout + abort propagation

**What / Why**
Use `AbortController` to enforce upstream timeout; on timeout, emit JSON-RPC error (`-32000`, message “upstream timeout”) and end once. 

**Where**
`/src/server/jungleClient.ts`, `/src/server/proxy.ts`

**Tests**
`timeout_abort.spec.ts`: mock stall → timeout error; no handle leaks; single terminal.

**Accept when**
Bounded latency; stream closed cleanly.

**LLM priming**
`AbortError`, `finally { res.end() }`, `setTimeout`

---
