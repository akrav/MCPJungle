## Ticket-406 — Retry jitter correctness (502/503 only)

**What / Why**
Unit-test **exponential backoff with jitter**, capped, retried only on 502/503.

**Where**
`/tests/sprint4/retry_jitter.spec.ts`

**Implementation sketch**

* Fake timers. Assert schedule (e.g., 100ms → ~300ms with jitter), cap honored.
* Non-retryable codes skip.

**Accept when**

* Schedule follows backoff+jitter; caps respected; other codes not retried.

**Plain English**

> Brief blips should retry a little, not forever—and not for bad requests.

**LLM priming**
`exponential backoff`, `full jitter`, `setTimeout mock`, `status 502/503 only`

---
