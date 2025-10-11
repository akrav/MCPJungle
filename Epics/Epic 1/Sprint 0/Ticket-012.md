## Ticket-012 — Progress relay (streaming)

**What / Why**
Forward progress events from Jungle to client **as they arrive**—Streamable HTTP behavior. ([Model Context Protocol][7])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**
Read `response.body.getReader()` and write to Express `res` progressively; flush.

**Tests**
`/tests/sprint0/proxyProgress.spec.ts`: mock emits 3 chunks; assert order & count (timing threshold).

**Accept when**
Ordered progress forwarded without end-buffering.

**Plain English**

> Keep users updated during long calls with live progress.

**LLM priming**
`streaming response`, `flush`, `res.write`, `ReadableStream reader`, `backpressure` ([Stack Overflow][9])

---
