## Ticket-104 — ID transparency contract test

**What / Why**
Guarantee **no ID remap** (string or number). JSON-RPC requires response `id` to equal request `id`. 

**Where**
Tests only.

**Implementation sketch**
`ids_transparency.spec.ts`: send `id:"abc-123"` and `id:99`; assert echo.

**Accept when**
All echo variants match exactly.

**LLM priming**
`=== strict equality`, `string|number id`

---
