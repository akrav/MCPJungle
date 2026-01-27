## Ticket-109 — Streaming progress (end-to-end)

**What / Why**
Pipe progress bytes **as they arrive** (ReadableStream → Express). 

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* `reader = resp.body.getReader()`; loop `read()`; `res.write(chunk)`; flush headers early.

**Tests**
`streaming_progress.spec.ts`: 3 delayed chunks arrive in order; no end-buffering.

**Accept when**
Observed inter-chunk timing confirms streaming.

**LLM priming**
`ReadableStream.getReader()`, `res.write`, `flush`

---
