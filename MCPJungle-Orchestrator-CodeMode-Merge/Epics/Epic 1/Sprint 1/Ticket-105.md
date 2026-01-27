## Ticket-105 — Error mapping (HTTP → JSON-RPC error)

**What / Why**
Map **non-JSON-RPC** upstream failures to JSON-RPC error `{code:-32000,message,...,data:{status}}`; pass through genuine JSON-RPC errors unchanged. 

**Where**
`/src/server/proxy.ts`

**Tests**
`error_mapping.spec.ts`: 502/HTML → `-32000` with `data.status=502`; if upstream already returns JSON-RPC error → pass-through.

**Accept when**
Mapping is deterministic and spec-valid.

**LLM priming**
`-32000 server error`, `content-type sniff`, `error.data.status`

---
