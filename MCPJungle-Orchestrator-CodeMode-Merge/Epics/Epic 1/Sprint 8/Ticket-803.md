## Ticket-803 — **Fallback to Jungle & Rollback master switch**  *(merged)*

**Why**
If router errs or exhausts retries, **fallback to Jungle**; plus an emergency lever `ORCH_ROLLBACK_TO_JUNGLE=true` that **overrides everything** (flag/header) to force 100% Jungle. 

**Where**
`router/fallback.ts`, `featureflags/flags.ts`, `server/http.ts`

**Implementation sketch**

* In `http.ts`: if `flags.rollback` → `proxyToJungle()` with banner log.
* Else try live; on router error / retry-exhausted 5xx → `proxyToJungle()`; preserve JSON-RPC `id`.

**Tests**
`fallback_and_rollback.spec.ts`:

* Router failure → Jungle succeeds; `id` echoed.
* With rollback=true → all requests bypass live router (header ignored).

**Accept when**
Rollback overrides all; fallback path preserves invariants.

**LLM priming**
`short-circuit`, `try/catch`, `retry budget exhausted`, `id echo`

---
