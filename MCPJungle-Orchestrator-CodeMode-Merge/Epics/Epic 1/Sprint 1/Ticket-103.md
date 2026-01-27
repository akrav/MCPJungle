## Ticket-103 — Pass-through JSON-RPC: **`tools/list` & `tools/call`**  *(merged)*

**What / Why**
Forward **both** discovery and execute to Jungle and return responses **unchanged** (byte-for-byte envelope). No batch inputs. 

**Where**
`/src/server/proxy.ts` (`proxyJsonRpc`), wired from `/mcp` in `http.ts`.

**Implementation sketch**

* Validate **single object** request (reject arrays).
* POST to Jungle via `jungleClient`; pipe bytes back; set `Content-Type: application/json`.
* **Do not** touch `id` or payload.

**Tests**
`mcp_passthrough.spec.ts`: table-driven cases for `tools/list` and `tools/call`; exact JSON match.

**Accept when**
Responses match Jungle exactly (string equality).

**LLM priming**
`tools/list`, `tools/call`, `res.setHeader('Content-Type','application/json')`, `pass-through`

---
