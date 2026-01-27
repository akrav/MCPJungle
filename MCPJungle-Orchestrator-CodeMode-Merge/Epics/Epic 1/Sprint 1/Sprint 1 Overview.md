# Sprint 1 — Single-Upstream Pass-Through (MCPJungle) — Updated

**Goal**
Make the orchestrator a **thin MCP proxy** to the **per-user MCPJungle** instance. The host client hits our **`/mcp`**; we forward JSON-RPC **one-for-one** to Jungle’s `/mcp`, **no batching**, **IDs untouched**, **progress streamed**, **cancel relayed**, and **errors mapped** sanely. Jungle handles discovery (`tools/list`) and execution (`tools/call`). 

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, loop & debug until green, then push.

**Repo layout (S1 additions highlighted)**

```
/orchestrator
  /src
    server/http.ts
    server/proxy.ts
    server/initialize.ts
    server/jungleClient.ts          # NEW in S1
    jsonrpc/{types,validate,errors}.ts
    config/{schema,load}.ts
    health/healthz.ts
    obs/log.ts
    testutils/{mockJungle}.ts
  /tests/sprint1                     # NEW in S1
    config_pass_through.spec.ts
    jungle_client_auth.spec.ts
    mcp_passthrough.spec.ts         # MERGED (list + call)
    ids_transparency.spec.ts
    error_mapping.spec.ts
    timeout_abort.spec.ts
    retry_backoff.spec.ts
    headers_hygiene.spec.ts
    streaming_progress.spec.ts
    cancel_relay.spec.ts
    content_type_guard.spec.ts
    per_user_instance.spec.ts
    compose_quickstart.spec.ts      # MERGED (compose + README)
  docker-compose.yml                 # updated profile for Jungle
  README.md                          # updated "Quickstart with MCPJungle"
```

---

## Ticket-101 — Env: add Jungle auth and timeouts

**What / Why**
Add `JUNGLE_URL`, **optional** `JUNGLE_TOKEN`, and `ORCH_UPSTREAM_TIMEOUT_MS` (default 30000). Fail fast if `JUNGLE_URL` missing. 

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* Zod schema with `url()`; `timeout` default; token optional.
* Export typed config `{ jungleUrl, jungleToken, upstreamTimeoutMs }`.

**Tests**
`config_pass_through.spec.ts` (table of env cases; missing URL → error; token optional).

**Accept when**
Invalid env yields clear errors; valid env returns typed config.

**LLM priming**
`z.string().url()`, `z.number().default(30000)`, `dotenv`, `process.env`

---

## Ticket-102 — Jungle HTTP client (Undici) with auth

**What / Why**
Tiny helper that POSTs exactly to `${JUNGLE_URL}/mcp` with optional `Authorization: Bearer`. Timeout via `AbortController`. Return raw `Response` for streaming. 

**Where**
`/src/server/jungleClient.ts`

**Implementation sketch**

* `fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token)},body,signal})`.
* Add `User-Agent: orchestrator/1.0`.

**Tests**
`jungle_client_auth.spec.ts`: with token → header present; without → absent; respects timeout.

**Accept when**
Headers correct; timeout enforced.

**LLM priming**
`undici fetch`, `AbortController`, `headers.set('Authorization','Bearer ...')`

---

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

## Ticket-106 — Timeout + abort propagation

**What / Why**
Use `AbortController` to enforce upstream timeout; on timeout, emit JSON-RPC error (`-32000`, message “upstream timeout”) and end once. 

**Where**
`/src/server/jungleClient.ts`, `/src/server/proxy.ts`

**Tests**
`timeout_abort.spec.ts`: mock stall → timeout error; no handle leaks; single terminal.

**Accept when**
Bounded latency; stream closed cleanly.

**LLM priming**
`AbortError`, `finally { res.end() }`, `setTimeout`

---

## Ticket-107 — Limited retry with backoff (502/503 only)

**What / Why**
Retry **max 2** times on 502/503 with **exponential backoff + jitter**; never retry cancels. 

**Where**
`/src/server/jungleClient.ts`

**Tests**
`retry_backoff.spec.ts`: 502→502→200 succeeds; attempts counted; latency > backoff sum.

**Accept when**
Only 502/503 retried; capped attempts; jitter applied.

**LLM priming**
`exponential backoff`, `full jitter`, `retry budget`

---

## Ticket-108 — Header hygiene (strip hop-by-hop; add Forwarded)

**What / Why**
Remove hop-by-hop headers; keep `Content-Type: application/json`; add `Forwarded`/`X-Forwarded-For` and `User-Agent`. 

**Where**
`/src/server/proxy.ts`

**Tests**
`headers_hygiene.spec.ts`: hop-by-hop gone; UA + Forwarded present.

**Accept when**
Headers are clean and predictable.

**LLM priming**
`Connection`, `Transfer-Encoding`, `X-Forwarded-For`, `User-Agent`

---

## Ticket-109 — Streaming progress (end-to-end)

**What / Why**
Pipe progress bytes **as they arrive** (ReadableStream → Express). 

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* `reader = resp.body.getReader()`; loop `read()`; `res.write(chunk)`; flush headers early.

**Tests**
`streaming_progress.spec.ts`: 3 delayed chunks arrive in order; no end-buffering.

**Accept when**
Observed inter-chunk timing confirms streaming.

**LLM priming**
`ReadableStream.getReader()`, `res.write`, `flush`

---

## Ticket-110 — Cancel relay (end-to-end)

**What / Why**
Forward a cancel **for the same `id`** to Jungle; ensure **one** terminal event and closed stream. 

**Where**
`/src/server/proxy.ts`

**Tests**
`cancel_relay.spec.ts`: start long call; send cancel; assert exactly one terminal outcome.

**Accept when**
Cancel relayed; no double-finalization.

**LLM priming**
`inflight Map`, `idempotent`, `single terminal`

---

## Ticket-111 — Content-Type guard

**What / Why**
Reject non-`application/json` with JSON-RPC `-32600 InvalidRequest`. 

**Where**
`/src/server/http.ts`

**Tests**
`content_type_guard.spec.ts`: `text/plain` → error; JSON → OK.

**Accept when**
Only JSON accepted.

**LLM priming**
`req.headers['content-type']?.startsWith('application/json')`, `-32600`

---

## Ticket-112 — Per-user Jungle instance attach (dev stub)

**What / Why**
Dev-mode **per-user** Jungle handle (keyed by `x-user-id`) to simulate multi-tenant behavior until Sprint 2 auth. 

**Where**
`/src/server/jungleClient.ts`, `/src/server/http.ts`

**Tests**
`per_user_instance.spec.ts`: different users → different handles; same user → reuse.

**Accept when**
Map behavior predictable; no PII logged.

**LLM priming**
`Map<string,Handle>`, `get-or-set`, `per-request context`

---

## Ticket-113 — **Compose + Quickstart with Jungle**  *(merged)*

**What / Why**
One command to boot **orchestrator + real MCPJungle** and a README section with copy-paste commands to test `tools/list`/`tools/call`. 

**Where**
`docker-compose.yml`, `README.md`

**Implementation sketch**

* Compose services: `jungle` (exposes `/mcp`) and `orch` (`JUNGLE_URL=http://jungle:9000`).
* README “Quickstart with MCPJungle”: env vars, compose up, sample `curl`.

**Tests**
`compose_quickstart.spec.ts`: `docker compose config` sanity; grep README for required headings and code blocks.

**Accept when**
Compose validates and docs are actionable.

**LLM priming**
`docker compose --profile jungle up`, `curl -X POST /mcp`, `application/json` bodies

---

## How to run Sprint 1 tests locally

```bash
# install deps
npm i

# run only Sprint 1 tests
npm run test -- tests/sprint1

# run dev server
npm run dev

# optional: run with a real Jungle via compose
docker compose --profile jungle up -d
export JUNGLE_URL=http://localhost:9000
```

---

### Why these priming cues work

They mirror the exact library/API names and MCP calls you’re already using (Express handlers, Supertest + Vitest patterns, Zod config, Undici streaming, JSON-RPC 2.0, MCP `tools/list` & `tools/call`). That nudges the model toward **idiomatic TS/Node** while keeping the orchestrator strictly **pass-through** for this sprint. 

If you want, I can also emit tiny **skeleton files** (headers + TODO asserts) so several tickets go green with near-zero extra calls.
