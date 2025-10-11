## Ticket-702 — Catalog core: **canonical IDs + merge/dedupe**  *(merged)*

**What / Why**
Normalize names to `server__tool` and merge multiple `tools/list` sources into a stable, deduped catalog.

**Where**
`/src/catalog/normalize.ts`, `/src/catalog/merge.ts`

**Implementation sketch**

* `canonicalId(server, tool)`: lowercase, `[a-z0-9_]`, replace others with `_`.
* Merge inputs `{server, tools[]}` → output array of `{id,name,server,desc,schemaHash,sources[]}`; prefer first occurrence; **stable sort** (server then tool).

**Tests**

* `norm_names.spec.ts`: table tests (spaces/unicode/punct).
* `merge_dedupe.spec.ts`: duplicates collapse; order deterministic.

**Accept when**
IDs are deterministic; merged list has no dupes and stable ordering.

**Plain English**

> Give every tool a clean, consistent ID and stitch all menus into one without duplicates.

**LLM priming**
`slugify`, `Map by key`, `stable sort`, `schema hash`

---
