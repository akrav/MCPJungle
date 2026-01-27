## Ticket-511 — **Undici Agent** keep-alive & small pool to Jungle

**Why**: Lower tail latencies; fewer TCP handshakes.
**Where**: `src/server/proxy.ts` (or `jungleClient.ts`)
**Impl sketch**:
`new Agent({ keepAliveTimeout, keepAliveMaxTimeout, pipelining: 1, connections: N })` and pass via `dispatcher`; pool size via env.
**Tests**: `pool_keepalive.spec.ts` hits a mock many times; checks `Connection: keep-alive` and low handshake churn.
**Accept**: Connections are reused across calls.
**LLM priming**: `undici Agent`, `dispatcher`, `keepAlive`, `connections`

---
