References we prime against (so your LLM leans on familiar patterns):

* **MCP concepts & flow** (discover via `tools/list`, execute via `tools/call`, Streamable HTTP). ([Model Context Protocol][1])
* **MCPJungle** as a unified **Gateway/Registry** providing a single `/mcp` endpoint. ([GitHub][2])
* **Express** (routing), **Vitest** (tests), **Supertest** (HTTP tests), **Zod** (config), **Undici** (streaming). ([expressjs.com][3])

---

# Sprint 1 — Single-Upstream Pass-Through (MCPJungle)

**Goal**
Make the orchestrator a **thin proxy** to the **per-user MCPJungle** instance. The agent only hits our **`/mcp`**; we **forward JSON-RPC** one-for-one to Jungle’s `/mcp`, **no batching**, **IDs untouched**, **progress streamed**, **cancel relayed**, and **errors mapped** sanely. Jungle handles discovery (`tools/list`) and execution (`tools/call`). ([Model Context Protocol][1])

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (same base layout as Sprint 0)**

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
    mcp_list_passthrough.spec.ts
    mcp_call_passthrough.spec.ts
    ids_transparency.spec.ts
    error_mapping.spec.ts
    timeout_abort.spec.ts
    retry_backoff.spec.ts
    headers_hygiene.spec.ts
    streaming_progress.spec.ts
    cancel_relay.spec.ts
    content_type_guard.spec.ts
    per_user_instance.spec.ts
    compose_integration.spec.ts
    readme_jungle_quickstart.spec.ts
  docker-compose.yml                 # updated profile for Jungle
  README.md                          # updated quickstart for Jungle
```

---

## Ticket-101 — Env: add Jungle auth and timeouts

**What / Why**
Add `JUNGLE_URL`, **optional** `JUNGLE_TOKEN`, and timeouts (`ORCH_UPSTREAM_TIMEOUT_MS`). Fail fast if `JUNGLE_URL` is missing. Jungle is our **only** upstream. ([GitHub][2])

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* Zod schema updates; defaults: timeout 30000 ms.
* `loadConfig()` exposes `jungleUrl`, `jungleToken`, `upstreamTimeoutMs`.

**Tests**
`/tests/sprint1/config_pass_through.spec.ts`: valid/invalid env tables (missing URL → error; token optional).

**Accept when**
Invalid env produces clear errors; valid env returns typed config.

**Plain English**

> Add the Jungle URL and optional token to our settings and stop early if they’re wrong.

**LLM priming**
`zod string().url()`, `nonempty()`, `default(30000)`, `dotenv`, `process.env` ([Zod][4])

---

## Ticket-102 — Jungle HTTP client (Undici) with auth

**What / Why**
Create a tiny client that POSTs **exactly** to `${JUNGLE_URL}/mcp`, adding `Authorization: Bearer <token>` when set; set `User-Agent` and timeout. Jungle exposes a single unified `/mcp`. ([GitHub][2])

**Where**
`/src/server/jungleClient.ts`

**Implementation sketch**

* Use **Undici fetch** with `AbortController` and timeout; return the raw `Response` so caller can stream.
* Headers: `Content-Type: application/json`, optional `Authorization`, `User-Agent: orchestrator/1.0`.

**Tests**
`/tests/sprint1/jungle_client_auth.spec.ts` using mock jungle: with token → header present; without token → absent.

**Accept when**
Client sends headers correctly and honors timeout.

**Plain English**

> A small HTTP helper that knows how to talk to Jungle’s `/mcp`.

**LLM priming**
`undici fetch`, `AbortController`, `headers.set('Authorization', 'Bearer ...')`, `timeout` ([Reddit][5])

---

## Ticket-103 — Pass through `tools/list` requests

**What / Why**
Forward JSON-RPC `tools/list` (discovery) to Jungle and return response **unchanged**. MCP clients discover first, then call. ([Model Context Protocol][1])

**Where**
`/src/server/proxy.ts` (new `proxyJsonRpc` function), used by `/mcp` route in `http.ts`.

**Implementation sketch**

* Validate single object (no array).
* POST body to Jungle via `jungleClient.postMcp(body)`; pipe back response bytes.
* Do **not** rewrite IDs or payload.

**Tests**
`/tests/sprint1/mcp_list_passthrough.spec.ts`: send a sample `tools/list` → assert identical JSON back.

**Accept when**
The entire envelope matches (string equality).

**Plain English**

> When the agent asks “what tools exist?”, we just ask Jungle and hand back the answer.

**LLM priming**
`tools/list`, `JSON.stringify(body)`, `res.setHeader('Content-Type','application/json')` ([Model Context Protocol][1])

---

## Ticket-104 — Pass through `tools/call` requests

**What / Why**
Forward JSON-RPC `tools/call` to Jungle and return response **unchanged**. ([Model Context Protocol][1])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**
Same as Ticket-103, but ensure large payloads are streamed efficiently.

**Tests**
`/tests/sprint1/mcp_call_passthrough.spec.ts`: send `tools/call` with params; assert the exact echoed ID and body.

**Accept when**
Envelope and `id` are identical to Jungle’s response.

**Plain English**

> When the agent invokes a tool, we forward the call and return exactly what Jungle says.

**LLM priming**
`tools/call`, `request-id echo`, `pass-through`, `pipe` ([Model Context Protocol][1])

---

## Ticket-105 — ID transparency contract test

**What / Why**
Guarantee **no ID remap**. JSON-RPC requires response `id` to match request `id`. ([GitHub][6])

**Where**
Tests only.

**Implementation sketch**
`/tests/sprint1/ids_transparency.spec.ts`: send `id:"abc-123"` and `id: 99`; ensure Jungle’s echoed ids are preserved byte-for-byte.

**Accept when**
All echo variants match.

**Plain English**

> Prove we never change or regenerate IDs.

**LLM priming**
`JSON-RPC 2.0 id echo`, `string or number IDs`, `strict equality ===`

---

## Ticket-106 — Error mapping (upstream → JSON-RPC error)

**What / Why**
Map Jungle upstream failures to **JSON-RPC errors** with `code:-32000` (server error), preserving `data.status` and a short `message`. (Do *not* hide JSON-RPC errors already produced by Jungle.) ([GitHub][6])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* If Jungle returns a **non-2xx** with a non-JSON-RPC body, wrap it as JSON-RPC error.
* If Jungle returns a JSON-RPC error, pass it through unchanged.

**Tests**
`/tests/sprint1/error_mapping.spec.ts`: mock 502 and 404 HTML → see `-32000` with `data.status`.

**Accept when**
All non-JSON-RPC failures wrap to spec-valid JSON-RPC errors.

**Plain English**

> If Jungle fails in an HTTP way, we convert it into a JSON-RPC error shape.

**LLM priming**
`-32000 Server error`, `error.data = { status }`, `content-type sniffing`

---

## Ticket-107 — Timeout + abort propagation

**What / Why**
Use `AbortController` to enforce upstream timeout; on timeout, return JSON-RPC error (`-32000`, message “upstream timeout”) and stop reading body. ([Reddit][5])

**Where**
`/src/server/jungleClient.ts`, `/src/server/proxy.ts`

**Implementation sketch**

* Start a timeout timer; call `controller.abort()`; handle `DOMException: AbortError`.
* Ensure Express response is ended exactly once.

**Tests**
`/tests/sprint1/timeout_abort.spec.ts`: mock stalls; expect error and no hang.

**Accept when**
No leaked handles; single terminal outcome.

**Plain English**

> Don’t wait forever—cancel the upstream call and tell the client it timed out.

**LLM priming**
`AbortController`, `setTimeout`, `AbortError`, `finally { res.end() }`

---

## Ticket-108 — Limited retry with backoff (502/503 only)

**What / Why**
Transient upstream failures (e.g., 502/503) should retry **max 2** times with exponential backoff and jitter. (Do *not* retry non-idempotent cancels.)

**Where**
`/src/server/jungleClient.ts`

**Implementation sketch**

* Retry on response status in {502,503}; backoff 100ms → 300ms (+- jitter).
* Add `x-retries` counter to logs.

**Tests**
`/tests/sprint1/retry_backoff.spec.ts`: mock returns 502 twice then 200; verify 3 attempts and overall success latency > backoff sum.

**Accept when**
Retries occur only on 502/503 and never on cancels.

**Plain English**

> Brief glitches should auto-retry a couple times, then give up.

**LLM priming**
`exponential backoff`, `jitter`, `retry budget`, `status 502 503`

---

## Ticket-109 — Header hygiene (strip hop-by-hop; add Forwarded)

**What / Why**
Remove hop-by-hop headers and add `User-Agent`, `Forwarded` (or `X-Forwarded-For`). Keep `Content-Type: application/json`. ([expressjs.com][3])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* Only forward whitelisted headers.
* Append `Forwarded` with client IP if available.

**Tests**
`/tests/sprint1/headers_hygiene.spec.ts`: assert unwanted headers are gone; UA and Forwarded present.

**Accept when**
Headers are clean and predictable.

**Plain English**

> Send only the safe, useful headers to Jungle.

**LLM priming**
`hop-by-hop headers`, `Connection`, `Transfer-Encoding`, `X-Forwarded-For`, `User-Agent`

---

## Ticket-110 — Streaming progress (end-to-end)

**What / Why**
Ensure we **pipe** progress bytes from Jungle to the client **as they arrive** (ReadableStream → Express response). MCP’s Streamable HTTP encourages streaming. ([MDN Web Docs][7])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* `const reader = resp.body.getReader()`; loop `read()`; `res.write(chunk)`; `res.flushHeaders()` as needed; finalize on `done`.
* Backpressure aware.

**Tests**
`/tests/sprint1/streaming_progress.spec.ts`: mock emits 3 chunks with delays; assert arrival order and inter-chunk timing.

**Accept when**
Chunks are observed in order without buffering to the end.

**Plain English**

> Show live progress for long operations.

**LLM priming**
`ReadableStream.getReader()`, `while(true){ read }`, `res.write`, `flush` ([MDN Web Docs][7])

---

## Ticket-111 — Cancel relay (end-to-end)

**What / Why**
Forward a cancel **for the same `id`** to Jungle and end the response cleanly. (Transparent IDs; single terminal event.)

**Where**
`/src/server/proxy.ts`

**Implementation sketch**

* Track in-flight calls by `id`. On cancel, POST a cancel notification to Jungle; end pipe; ignore duplicate finals.

**Tests**
`/tests/sprint1/cancel_relay.spec.ts`: start long call; send cancel; assert exactly one terminal.

**Accept when**
Cancel works and never double-finalizes.

**Plain English**

> If the caller cancels, Jungle cancels, and we close the stream once.

**LLM priming**
`inflight Map`, `idempotent`, `single terminal`, `controller.abort()`

---

## Ticket-112 — Content-Type guard

**What / Why**
If incoming `Content-Type` is not `application/json`, reject with JSON-RPC `-32600 InvalidRequest`. (We only accept JSON.) ([GitHub][6])

**Where**
`/src/server/http.ts`

**Implementation sketch**

* Check header; if mismatched, respond with a JSON-RPC error body.

**Tests**
`/tests/sprint1/content_type_guard.spec.ts`: send `text/plain` → error; send proper JSON → OK.

**Accept when**
Only `application/json` is accepted.

**Plain English**

> Only accept JSON requests.

**LLM priming**
`req.headers['content-type']`, `startsWith('application/json')`, `-32600`

---

## Ticket-113 — Per-user Jungle instance attach (dev stub)

**What / Why**
Attach or spawn **per-user** Jungle instance (dev stub). Until Sprint 2 auth, accept a dev header `x-user-id` to key the instance map.

**Where**
`/src/server/jungleClient.ts`, `/src/server/http.ts`

**Implementation sketch**

* In memory `Map<userId, JungleHandle>`; create or reuse on first use.
* Log `userId` association (no PII).

**Tests**
`/tests/sprint1/per_user_instance.spec.ts`: two users → different handles; same user → same handle reused.

**Accept when**
Instance map behaves predictably in tests.

**Plain English**

> Pretend each user has their own Jungle; reuse it when the same user calls again.

**LLM priming**
`Map<string,Handle>`, `get or set`, `dependency injection`, `per-request context`

---

## Ticket-114 — Compose profile for real Jungle

**What / Why**
Add a `docker-compose.yml` profile to run **orchestrator + a real MCPJungle** for manual testing.

**Where**
`docker-compose.yml`

**Implementation sketch**

* Service `jungle` exposing `/mcp`; service `orch` with `JUNGLE_URL=http://jungle:9000`.
* Document how to start with `docker compose --profile jungle up`.

**Tests**
`/tests/sprint1/compose_integration.spec.ts`: shell script that runs `docker compose config` to sanity-check, and (optionally) spins up and hits `/healthz` quickly.

**Accept when**
Compose validates; quick smoke can run.

**Plain English**

> One command to boot our server with a real Jungle.

**LLM priming**
`docker-compose profiles`, `depends_on`, `healthcheck`, `bridge network`

---

## Ticket-115 — README: Jungle quickstart + e2e note

**What / Why**
Document how to run with **real Jungle** and how to point tests at it.

**Where**
`README.md`

**Implementation sketch**

* Add “Quickstart with MCPJungle” section: env variables, compose command, `curl` examples for `tools/list` and `tools/call`.
* Note: by default, tests use **mock Jungle**; set `JUNGLE_URL` to hit real Jungle.

**Tests**
`/tests/sprint1/readme_jungle_quickstart.spec.ts`: grep README for required sections/code blocks.

**Accept when**
Section present and accurate.

**Plain English**

> Clear instructions for using a real Jungle in minutes.

**LLM priming**
`curl -X POST http://localhost:8080/mcp`, `tools/list`, `tools/call`, `application/json` bodies

---

## How to run tests locally (TypeScript)

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

* They mirror **exact library/API names** and code shapes common in docs & examples (Express route handlers, Supertest calls, Vitest assertions, Zod schemas, Undici streaming). That steers a decoder-only model toward **idiomatic TS/Node** solutions and **MCP-accurate** pass-through patterns (discover via `tools/list`, execute via `tools/call`). ([expressjs.com][3])


[1]: https://modelcontextprotocol.io/docs/concepts/architecture?utm_source=chatgpt.com "Architecture overview"
[2]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "mcpjungle/MCPJungle: Self-hosted MCP Gateway and ..."
[3]: https://expressjs.com/en/starter/basic-routing.html?utm_source=chatgpt.com "Basic routing"
[4]: https://zod.dev/basics?utm_source=chatgpt.com "Basic usage"
[5]: https://www.reddit.com/r/mcp/comments/1m3bgxy/a_selfhosted_gateway_to_access_your_mcp_servers/?utm_source=chatgpt.com "A self-hosted Gateway to access your MCP servers from one ..."
[6]: https://github.com/nodejs/undici/issues/2122?utm_source=chatgpt.com "fetch: set body with byte reading support · Issue #2122"
[7]: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/getReader?utm_source=chatgpt.com "ReadableStream: getReader() method - Web APIs - MDN"
