## Ticket-403 — Progress ordering & timeliness

**What / Why**
Validate **in-order** progress frames arrive progressively (no end-buffering). Streamable HTTP must deliver incrementally.

**Where**
`/tests/sprint4/progress_ordering.spec.ts`

**Implementation sketch**

* Mock emits 3 progress chunks with staggered delays.
* Capture arrival times; assert order and a max inter-chunk delay threshold.

**Accept when**

* Chunks are ordered and timely.

**Plain English**

> Users should see progress updates as they happen, in order.

**LLM priming**
`ReadableStream`, `getReader`, `res.write`, `timing threshold`

---
