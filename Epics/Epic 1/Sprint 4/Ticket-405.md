## Ticket-405 — Timeout behavior is bounded & clear

**What / Why**
If Jungle stalls, use **AbortController** and return a **JSON-RPC server error** with timeout context; span status = ERROR.

**Where**
`/tests/sprint4/timeout_behavior.spec.ts`

**Implementation sketch**

* Mock stall. Assert JSON-RPC error (e.g., `-32000`), message includes “timeout”.
* Verify no leaked handles; span marked ERROR.

**Accept when**

* Bounded latency; clear error; clean shutdown.

**Plain English**

> Don’t hang forever—time out and report it clearly.

**LLM priming**
`AbortController`, `AbortSignal.timeout`, `-32000 server error`, `finally res.end()`, `SpanStatusCode.ERROR`

---
