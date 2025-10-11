## Ticket-407 — HTTP error → JSON-RPC error mapping

**What / Why**
Map non-JSON-RPC HTTP errors (e.g., HTML 502) to **JSON-RPC error** (`-32000…-32099`) with status in `error.data`.

**Where**
`/tests/sprint4/http_error_mapping.spec.ts`

**Implementation sketch**

* Mock 502 text/html; assert envelope with `error.data.status=502`.

**Accept when**

* Deterministic, spec-compliant mapping.

**Plain English**

> Turn plain HTTP failures into JSON-RPC-shaped errors.

**LLM priming**
`-32000 server error`, `error.data.status`, `content-type sniff`

---
