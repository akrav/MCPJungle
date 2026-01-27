## Ticket-010 — Proxy client to MCPJungle

**What / Why**
Forward a single JSON-RPC object to **MCPJungle `/mcp`** and stream back the response unchanged. Jungle is the unified gateway/registry. ([GitHub][1])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* Use **Undici fetch**; set a **timeout**; copy only safe headers; inject `User-Agent`.
* Relay body chunks as-is (ReadableStream). ([undici.nodejs.org][8])

**Tests**

* `/src/testutils/mockJungle.ts`: in-proc fake `/mcp` that echoes ID & body.
* `/tests/sprint0/proxyHappy.spec.ts`: call → expect **exact ID** and identical envelope.

**Accept when**
1:1 relay; IDs preserved; no mutation.

**Plain English**

> When we get a call, send it to Jungle and return exactly what Jungle said.

**LLM priming**
`undici fetch`, `ReadableStream`, `pipe`, `proxy`, `pass-through`, `X-Forwarded-For`

---


Status: Completed - 2025-10-11
