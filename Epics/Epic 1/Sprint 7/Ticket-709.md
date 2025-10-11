## Ticket-709 — Error envelopes remain spec-compliant

**What / Why**
Confirm JSON-RPC error codes & shapes are unchanged by new code paths.

**Where**
Extend sprint-4 mapping tests or add `/tests/sprint7/...` assertions.

**Implementation sketch**

* Drive non-JSON body and HTTP 5xx from Jungle; verify JSON-RPC mapping unchanged.

**Accept when**
`-32600/-32601/-32603` and `-32000…-32099` shapes match prior behavior.

**Plain English**

> Clients must keep seeing the exact error shapes they expect.

**LLM priming**
`error.data.status`, `envelope shape`, `prior contract tests`

---
