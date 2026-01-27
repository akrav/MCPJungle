## Ticket-008 — Minimal `initialize` happy path

**What / Why**
Handle `method: "initialize"` with a minimal MCP-style success payload to complete the handshake (messages are JSON-RPC). ([Model Context Protocol][2])

**Where**
`/src/server/http.ts`, `/src/server/initialize.ts`

**Implementation sketch**
Echo same `id`; `result` includes server name and protocol revision string (constant). (MCP runs messages over Streamable HTTP.) ([Model Context Protocol][7])

**Tests**
`/tests/sprint0/mcpInitialize.spec.ts`: POST initialize → 200 + result.

**Accept when**
Initialize returns valid JSON-RPC success.

**Plain English**

> Say “hello” the MCP way and include basic server info.

**LLM priming**
`switch (method)`, `initialize`, `result object`, `jsonrpc: "2.0"`

---
