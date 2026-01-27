## Ticket-804 — Timeout & limited retries (router path)

**Why**
Bound latency; retry a little on safe errors (502/503) with jitter. Mirrors mesh behavior. 

**Where**
`router/live.ts` policy reference, `server/jungleClient.ts` if reused.

**Implementation sketch**

* Export `{timeoutMs, retryCodes:[502,503], maxRetries:2, backoff: exponential+jitter}`; enforce via `AbortController`.

**Tests**
`timeout_retry_policy.spec.ts`: stall → timeout; 502→502→200 succeeds.

**Accept when**
Policy matches behavior; JSON-RPC errors mapped (`-32000`).

**LLM priming**
`AbortController`, `exponential backoff + jitter`, `-32000 server error`

---
