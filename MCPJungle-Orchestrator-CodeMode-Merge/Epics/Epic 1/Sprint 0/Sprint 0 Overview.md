> Reference anchors used for wording & constraints:
>
> * **MCP basics & Streamable HTTP** (messages are JSON-RPC; transports include Streamable HTTP). ([Model Context Protocol][2])
> * **MCPJungle** acts as a unified **gateway/registry** at `/mcp`. ([GitHub][1])
> * **JSON-RPC 2.0** envelope, error codes, and ID echo rules. ([Model Context Protocol][2])
> * Framework & tooling docs: **Express**, **Vitest**, **Supertest**, **Zod**, **Undici** (streaming), **Docker**. ([expressjs.com][3])

---

# Sprint 0 — “Pass-Through Orchestrator” (TypeScript)

**Goal:** Minimal TS server exposing **`/mcp`** and **`/healthz`**, strictly **non-batch** JSON-RPC handling, pass-through proxy to **MCPJungle `/mcp`**, config validation, structured logs with redaction, CI, Docker, golden fixtures, and a tiny e2e smoke.

**Sprint rule of engagement:** Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green, then push.

**Repo layout (created during Sprint 0)**

```
/orchestrator
  /src
    server/http.ts
    server/proxy.ts
    server/initialize.ts
    jsonrpc/types.ts
    jsonrpc/validate.ts
    jsonrpc/errors.ts
    config/schema.ts
    config/load.ts
    health/healthz.ts
    obs/log.ts
    testutils/mockJungle.ts
  /tests/sprint0
    repoLayout.spec.ts
    httpBootstrap.spec.ts
    jsonrpcTypes.spec.ts
    mcpInitialize.spec.ts
    initializePayload.spec.ts
    healthz.spec.ts
    jsonrpcErrors.spec.ts
    idInvariants.spec.ts
    logMiddleware.spec.ts
    proxyHappy.spec.ts
    proxyBatchGuard.spec.ts
    proxyProgress.spec.ts
    proxyCancel.spec.ts
    dockerBuild.test.sh
    e2e_smoke.sh
  /tests/fixtures
    initialize_req.json
    initialize_res.json
  package.json
  tsconfig.json
  .eslintrc.cjs
  .prettierrc
  .editorconfig
  .gitignore
  .github/workflows/ci.yml
  Dockerfile
  docker-compose.yml
  README.md
```

---

## Ticket-001 — Repo scaffold & CI smoke

**What / Why**
Initialize TS project and a green CI run to prove the pipeline.

**Where**
`package.json`, `tsconfig.json`, `.github/workflows/ci.yml`

**Implementation sketch**

* Scripts: `build` (tsc), `dev` (tsx src/server/http.ts), `test` (vitest run).
* CI: checkout → setup Node LTS → `npm ci` → `npm run test`. (Standard Node/Express doc baselines.) ([expressjs.com][3])

**Tests**
`/tests/sprint0/repoLayout.spec.ts`: assert key files exist.

**How to run**
`npm i && npm run test`

**Accept when**
CI shows tests passed on PR.

**Plain English**

> Set up Node + TypeScript and make sure CI can run tests.

**LLM priming (keywords/APIs)**
`Node.js LTS`, `TypeScript`, `tsconfig.json`, `Vitest`, `GitHub Actions node`, `npm ci`, `npm run test` ([Vitest][4])

---

## Ticket-002 — Editor/lint/format baseline

**What / Why**
Add `.editorconfig`, ESLint, Prettier, `.gitignore` for consistent diffs.

**Where**
Root config files

**Implementation sketch**

* ESLint with `@typescript-eslint`, Prettier integration; add `npm run lint`.

**Tests**
Add CI step `npm run lint`; it must pass.

**Accept when**
Lint is clean locally and in CI.

**Plain English**

> Agree on formatting and linting so PRs are clean.

**LLM priming**
`eslint`, `@typescript-eslint`, `prettier`, `lint-staged`, `husky hook`

---

## Ticket-003 — Config schema & loader

**What / Why**
Fail fast on env: `JUNGLE_URL`, `PORT` default 8080, `BIND` default 127.0.0.1, `LOG_LEVEL`.

**Where**
`/src/config/schema.ts`, `/src/config/load.ts`

**Implementation sketch**

* **Zod** schema + `loadConfig()` returning typed config. ([Zod][5])

**Tests**
`/tests/sprint0/config.spec.ts`: valid/invalid env tables → expect parse or helpful error text.

**Accept when**
Invalid env yields explicit errors; valid env returns typed object.

**Plain English**

> Make sure URL/port are correct before the server starts.

**LLM priming**
`zod object`, `z.infer`, `env parsing`, `dotenv`, `process.env` ([Zod][5])

---

## Ticket-004 — Minimal logger with redaction

**What / Why**
Structured NDJSON logs; redact `Authorization` and any `*token*` fields.

**Where**
`/src/obs/log.ts`

**Implementation sketch**
`log(level, msg, fields)` with redaction helper; pretty in dev, NDJSON in prod.

**Tests**
`/tests/sprint0/logMiddleware.spec.ts`: capture output, assert tokens are masked.

**Accept when**
No secrets appear in logs.

**Plain English**

> Log useful info but hide sensitive bits.

**LLM priming**
`pino-like NDJSON`, `redact fields`, `structured logging`, `mask Authorization`

---

## Ticket-005 — HTTP server + `/healthz`

**What / Why**
Express server exposing `GET /healthz` for liveness & quick diagnostics.

**Where**
`/src/server/http.ts`, `/src/health/healthz.ts`

**Implementation sketch**
Use **Express**; `GET /healthz` → `{ ok: true, version, jungleUrl }`. ([expressjs.com][3])

**Tests**
`/tests/sprint0/healthz.spec.ts` using **Supertest**: expect 200 JSON. ([npm][6])

**Accept when**
Health returns 200 with required fields.

**Plain English**

> Prove it’s running and show the Jungle URL it will call.

**LLM priming**
`express()`, `app.get('/healthz')`, `supertest request(app)`, `toHaveProperty`

---

## Ticket-006 — JSON-RPC 2.0 envelope types

**What / Why**
Define request/response/error types and validators: **result XOR error**, **echo id**.

**Where**
`/src/jsonrpc/types.ts`, `/src/jsonrpc/validate.ts`

**Implementation sketch**
Type guards + small validation helpers following **JSON-RPC 2.0**. ([Model Context Protocol][2])

**Tests**
`/tests/sprint0/jsonrpcTypes.spec.ts`: valid/invalid envelopes; mutual exclusivity; `jsonrpc: "2.0"`.

**Accept when**
Validation enforces the spec.

**Plain English**

> Define the shapes we’ll accept and return.

**LLM priming**
`JSON-RPC 2.0`, `result vs error`, `id echo`, `invalid request -32600` ([Model Context Protocol][2])

---

## Ticket-007 — `/mcp` POST bootstrap (reject batches)

**What / Why**
Add `POST /mcp` that parses a single JSON-RPC **object**; reject arrays.

**Where**
`/src/server/http.ts`

**Implementation sketch**

* If `Array.isArray(body)` → **InvalidRequest (-32600)**; else parse object.
* This aligns with Streamable HTTP single-request style for MVP. ([Model Context Protocol][7])

**Tests**
`/tests/sprint0/httpBootstrap.spec.ts`: `GET /mcp` → 405; `POST []` → error; `POST {}` → placeholder success.

**Accept when**
Arrays are rejected; single object accepted.

**Plain English**

> Build the front door and refuse batch calls for now.

**LLM priming**
`Express POST route`, `JSON.parse`, `Array.isArray`, `-32600 InvalidRequest` ([Model Context Protocol][2])

---

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

## Ticket-009 — JSON-RPC error helpers

**What / Why**
Factory for spec codes: `-32600 InvalidRequest`, `-32601 Method not found`, `-32603 Internal error`. ([Model Context Protocol][2])

**Where**
`/src/jsonrpc/errors.ts`

**Implementation sketch**
`jsonRpcError(code, message, data?)` returning `{ jsonrpc: "2.0", error, id }`.

**Tests**
`/tests/sprint0/jsonrpcErrors.spec.ts`: table asserts shape & codes.

**Accept when**
All helpers produce spec-compliant errors.

**Plain English**

> One place to build standard JSON-RPC errors.

**LLM priming**
`error codes -32600 -32601 -32603`, `RFC-like table`, `factory function`

---

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

## Ticket-011 — Guardrail: reject JSON-RPC batching (again at proxy)

**What / Why**
Hard-fail if the inbound body is an array, even before proxy (defense in depth).

**Where**
`/src/server/http.ts`

**Implementation sketch**
If array → **InvalidRequest (-32600)**; do not contact Jungle. ([Model Context Protocol][2])

**Tests**
`/tests/sprint0/proxyBatchGuard.spec.ts`: POST array → error; ensure Jungle mock was not called.

**Accept when**
Arrays always return `InvalidRequest`.

**Plain English**

> Don’t allow multiple calls in one request yet.

**LLM priming**
`short-circuit`, `guard clause`, `return early`, `400-equivalent JSON-RPC`

---

## Ticket-012 — Progress relay (streaming)

**What / Why**
Forward progress events from Jungle to client **as they arrive**—Streamable HTTP behavior. ([Model Context Protocol][7])

**Where**
`/src/server/proxy.ts`

**Implementation sketch**
Read `response.body.getReader()` and write to Express `res` progressively; flush.

**Tests**
`/tests/sprint0/proxyProgress.spec.ts`: mock emits 3 chunks; assert order & count (timing threshold).

**Accept when**
Ordered progress forwarded without end-buffering.

**Plain English**

> Keep users updated during long calls with live progress.

**LLM priming**
`streaming response`, `flush`, `res.write`, `ReadableStream reader`, `backpressure` ([Stack Overflow][9])

---

## Ticket-013 — Cancel relay (basic)

**What / Why**
Accept a cancel notification for a specific `id` and forward it to Jungle using the **same id**.

**Where**
`/src/server/proxy.ts`

**Implementation sketch**
Map in-flight IDs; on cancel, forward; treat 404 from Jungle as idempotent success.

**Tests**
`/tests/sprint0/proxyCancel.spec.ts`: start long call, send cancel; verify exactly **one** terminal event.

**Accept when**
Single terminal event; call stops; no double-final.

**Plain English**

> If the caller cancels, we make Jungle cancel too.

**LLM priming**
`in-flight map`, `idempotent cancel`, `single terminal state`, `controller.abort()`

---

## Ticket-014 — Golden fixtures for `initialize`

**What / Why**
Byte-for-byte golden tests for the initialize request/response to catch regressions.

**Where**
`/tests/fixtures/initialize_req.json`, `initialize_res.json`, test in `/tests/sprint0/initializePayload.spec.ts`

**Implementation sketch**
Load fixtures and compare to live response.

**Tests**
Golden compare (string equality).

**Accept when**
Exact match; test green.

**Plain English**

> Freeze the expected JSON so we notice accidental changes.

**LLM priming**
`golden master`, `snapshot-like test`, `byte-for-byte compare`, `fixture`

---

## Ticket-015 — Dockerfile, Compose, README, and e2e smoke

**What / Why**
Package the service; one-command local demo; prove end-to-end with a smoke script.

**Where**
`Dockerfile`, `docker-compose.yml`, `README.md`, `/tests/sprint0/dockerBuild.test.sh`, `/tests/sprint0/e2e_smoke.sh`

**Implementation sketch**

* Multi-stage Dockerfile & `.dockerignore` following official best practices. ([expressjs.com][3])
* Compose service `orch` + `mockJungle`; env wires `JUNGLE_URL`.
* README Quickstart with `curl` for `/healthz` and `/mcp` initialize.

**Tests**

* `dockerBuild.test.sh`: `docker build -t orch:local .` → exit 0.
* `e2e_smoke.sh`: start server, hit `/healthz`, POST initialize → success.

**Accept when**
Image builds; smoke passes locally.

**Plain English**

> Containerize it and prove the whole flow end-to-end on your machine.

**LLM priming**
`Docker multi-stage`, `node:alpine`, `npm ci --only=production`, `docker-compose up`, `healthcheck` ([expressjs.com][3])

---

## How to run tests locally (TypeScript)

```bash
# install deps
npm i

# run all unit/integration tests
npm run test

# run only sprint-0 tests
npm run test -- tests/sprint0

# dev server (uses env; mock Jungle in tests)
npm run dev
```

When pointing at a real MCPJungle, set `JUNGLE_URL=http://<host>:<port>` (Jungle exposes a unified **/mcp** over **Streamable HTTP**). ([GitHub][1])

---

### Why these priming cues work

* They mirror the **exact library and API names** prominent in open-source examples and docs (Express route shapes, Supertest call patterns, Vitest expectations, Zod schema syntax, Undici streaming calls), nudging the LLM toward **idiomatic TS/Node** solutions it’s likely seen. ([expressjs.com][3])


[1]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "mcpjungle/MCPJungle: Self-hosted MCP Gateway and ..."
[2]: https://modelcontextprotocol.io/specification/2024-11-05/basic/messages?utm_source=chatgpt.com "Messages"
[3]: https://expressjs.com/en/starter/hello-world.html?utm_source=chatgpt.com "Express \"Hello World\" example"
[4]: https://vitest.dev/?utm_source=chatgpt.com "Vitest | Next Generation testing framework"
[5]: https://zod.dev/?utm_source=chatgpt.com "Zod: Intro"
[6]: https://www.npmjs.com/package/supertest?utm_source=chatgpt.com "Supertest"
[7]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports?utm_source=chatgpt.com "Transports"
[8]: https://undici.nodejs.org/?utm_source=chatgpt.com "Node.js Undici"
[9]: https://stackoverflow.com/questions/40385133/retrieve-data-from-a-readablestream-object?utm_source=chatgpt.com "javascript - Retrieve data from a ReadableStream object?"
