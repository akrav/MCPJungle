## Ticket-701 — Config flags for catalog & shadow router

**What / Why**
Feature toggles to enable catalog building and shadow routing without affecting live behavior:
`ORCH_ENABLE_CATALOG=false`, `ORCH_ENABLE_SHADOW_ROUTER=false`.

**Where**
`/src/config/{schema.ts,load.ts}` (Zod booleans), README update.

**Tests**
`readme_catalog_toggle.spec.ts` ensures flags are documented and parsed.

**Accept when**
Flags parse with defaults; README shows how to turn them on.

**LLM priming**
`z.boolean().default(false)`, `process.env`, `feature toggle`, `README section: "Router & Catalog (shadow)"`

---
