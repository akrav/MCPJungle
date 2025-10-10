Reference anchors (for correctness & wording):

* **OWASP API Security Top-10 2023** (API1 BOLA / API3 BOPLA). ([owasp.org][1])
* **Bearer tokens** (OAuth 2.0, RFC 6750). ([RFC Editor][2])
* **OpenTelemetry for Node.js / JS** (getting started, manual/auto instrumentation). ([OpenTelemetry][3])
* **Express security best practices & Helmet**. ([expressjs.com][4])
* **AbortController timeouts** (Node fetch/Undici). ([MDN Web Docs][5])

---

# Sprint 2 — Security & Observability (beefed-up MVP)

**Goal**
Ship real **AuthN/AuthZ** and **OpenTelemetry** from day one. Add TLS/mTLS guidance (infra-led), secure headers, request limits, and log/trace correlation. Keep the pass-through behavior to MCPJungle unchanged.

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If a test fails, **loop & debug** until green, then push.

**Repo (same layout as S0–S1; new files noted below)**

```
/orchestrator
  /src
    server/http.ts
    server/proxy.ts
    server/initialize.ts
    server/jungleClient.ts
    auth/bearer.ts            # NEW in S2
    auth/authorize.ts         # NEW in S2
    obs/otel.ts               # NEW in S2
    obs/log.ts
    security/helmet.ts        # NEW in S2
    security/limits.ts        # NEW in S2 (body size, content-type recheck)
    config/{schema,load}.ts
    jsonrpc/{types,validate,errors}.ts
    health/healthz.ts
  /tests/sprint2              # NEW in S2
    bearer_parse.spec.ts
    authz_allowlist.spec.ts
    helmet_headers.spec.ts
    size_limit.spec.ts
    content_type_enforce.spec.ts
    trace_init.spec.ts
    trace_list_call.spec.ts
    trace_error_status.spec.ts
    metrics_histograms.spec.ts
    log_trace_correlation.spec.ts
    timeout_abort_trace.spec.ts
    tls_mtls_readme.spec.ts
  README.md (updated)
  .github/workflows/ci.yml (updated)
```

---

## Ticket-201 — Bearer token parsing (AuthN middleware)

**What / Why**
Parse `Authorization: Bearer <token>` from incoming requests and attach an **auth context** (userId/tenantId/roles if present) to `req`. Bearer usage follows **RFC 6750**. ([RFC Editor][2])

**Where**
`/src/auth/bearer.ts`

**Implementation sketch**

* Express middleware: extract header; if missing → `401` JSON-RPC error (`-32000`, message “missing bearer token”).
* If present: decode (for MVP, accept opaque or JWT; no signature verify yet), parse claims if JWT-shaped, set `res.locals.auth`.

**Tests**
`/tests/sprint2/bearer_parse.spec.ts`:

* No header → 401 JSON-RPC error body;
* `Authorization: Bearer abc` → attaches `auth.token="abc"`.

**Accept when**
Requests without tokens fail; with tokens proceed and context is set.

**Plain English**

> Check for a token and put the user info on the request so later checks can use it.

**LLM priming**
`Authorization: Bearer`, `RFC 6750`, `req.headers.authorization`, `res.locals`, `next()` ([Swagger][6])

---

## Ticket-202 — Method-level allow-list (AuthZ guard)

**What / Why**
Block unexpected JSON-RPC methods up front; allow only `{initialize, tools/list, tools/call, cancel}`. Helps mitigate **API1/API3** style issues by constraining surface. ([owasp.org][1])

**Where**
`/src/auth/authorize.ts` (middleware used before proxy)

**Implementation sketch**

* Read parsed JSON-RPC `method` from body; if not in allow-list → JSON-RPC `-32601 Method not found`.
* Optionally bind to tenant on `res.locals.auth`.

**Tests**
`/tests/sprint2/authz_allowlist.spec.ts`: allowed methods pass, others return `-32601`.

**Accept when**
Only approved methods reach the proxy.

**Plain English**

> Only let through the specific MCP methods we support.

**LLM priming**
`allowlist`, `switch(method)`, `-32601`, `least privilege`, `OWASP API` ([owasp.org][1])

---

## Ticket-203 — Secure headers via Helmet

**What / Why**
Apply **Helmet** to set basic security headers, per Express best practices. ([expressjs.com][4])

**Where**
`/src/security/helmet.ts`; wired in `server/http.ts`

**Implementation sketch**

* `app.use(helmet())`; tune for JSON APIs (disable CSP reportOnly if noisy).
* Do **not** break streaming.

**Tests**
`/tests/sprint2/helmet_headers.spec.ts`:

* `GET /healthz` shows `X-Content-Type-Options: nosniff`, etc.

**Accept when**
Expected headers present; responses still stream.

**Plain English**

> Add standard security headers that browsers and tools expect.

**LLM priming**
`helmet()`, `nosniff`, `x-dns-prefetch-control`, `hidePoweredBy` ([expressjs.com][4])

---

## Ticket-204 — Content-Type & size limits

**What / Why**
Enforce `Content-Type: application/json` and body size limit (e.g., 1–2 MB) to shrink risk and resource abuse. (We already checked Content-Type in S1; here we hard-enforce size.)

**Where**
`/src/security/limits.ts`

**Implementation sketch**

* Express JSON parser with `limit: '1mb'`;
* If bad content-type or size → JSON-RPC `-32600 InvalidRequest`.

**Tests**
`/tests/sprint2/size_limit.spec.ts`, `content_type_enforce.spec.ts`: oversized payload rejected; wrong type rejected.

**Accept when**
Oversized/invalid requests are blocked consistently.

**Plain English**

> Only accept JSON and only up to a safe size.

**LLM priming**
`express.json({ limit:'1mb' })`, `req.is('application/json')`, `-32600` ([expressjs.com][4])

---

## Ticket-205 — OpenTelemetry bootstrap (Node SDK)

**What / Why**
Initialize **OpenTelemetry** for traces & metrics (OTLP exporter), so every request has a trace and spans around critical operations. ([OpenTelemetry][3])

**Where**
`/src/obs/otel.ts`; called from `server/http.ts` at startup

**Implementation sketch**

* `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-metrics-otlp-http`, `Resource` with `service.name='orchestrator'`.
* Enable auto-instrumentations for `http` and `undici`; sample at 100% in dev.

**Tests**
`/tests/sprint2/trace_init.spec.ts`: start server with test exporter; assert a root span is created for a request.

**Accept when**
A trace is emitted per request in tests.

**Plain English**

> Turn on tracing and metrics so we can see what’s happening.

**LLM priming**
`@opentelemetry/sdk-node`, `OTLPTraceExporter`, `OTLPMetricsExporter`, `Resource`, `service.name` ([OpenTelemetry][7])

---

## Ticket-206 — Spans for initialize, list, call

**What / Why**
Create named spans around: `initialize`, `tools/list`, `tools/call` with attributes (`user_id`, `tenant_id`, `tool_name`, `upstream_latency_ms`). ([OpenTelemetry][7])

**Where**
Wrap logic inside `server/http.ts` and `server/proxy.ts`

**Implementation sketch**

* Use tracer from `otel.ts`; set attributes + status on error.

**Tests**
`/tests/sprint2/trace_list_call.spec.ts`: run calls against mock Jungle; assert spans exist with attributes.

**Accept when**
Spans show up with names and attributes.

**Plain English**

> Mark the important steps so traces tell a clear story.

**LLM priming**
`tracer.startSpan('tools/list')`, `span.setAttribute`, `span.setStatus({code: ERROR})` ([OpenTelemetry][7])

---

## Ticket-207 — Error ↔ status mapping in traces

**What / Why**
Map error cases to span status and include `error.type`, `http.status_code`.

**Where**
`server/proxy.ts`

**Implementation sketch**

* On upstream non-JSON-RPC failure or timeout, set span status `ERROR` and attributes.

**Tests**
`/tests/sprint2/trace_error_status.spec.ts`: force 502 or timeout; assert status/attributes on span.

**Accept when**
Errors are reflected in spans.

**Plain English**

> Make traces show failures clearly so we can debug fast.

**LLM priming**
`SpanStatusCode.ERROR`, `span.recordException(err)`, `setAttribute('http.status_code',502)`

---

## Ticket-208 — Metrics: counters & histograms

**What / Why**
Add basic metrics: `requests_total`, `errors_total`, and `request_duration_ms` histogram (P95, P99 useful later). ([OpenTelemetry][7])

**Where**
`/src/obs/otel.ts` (meter & instruments), used in `http.ts`/`proxy.ts`

**Implementation sketch**

* Use OTel **Meter**: counter add on request/err; record duration on completion.

**Tests**
`/tests/sprint2/metrics_histograms.spec.ts`: simple run asserts instruments are updated (via in-memory exporter or test hook).

**Accept when**
Metrics update deterministically in tests.

**Plain English**

> Count requests/errors and measure how long things take.

**LLM priming**
`meter.createCounter`, `createHistogram`, `histogram.record(ms)` ([OpenTelemetry][7])

---

## Ticket-209 — Log ↔ trace correlation

**What / Why**
Add `trace_id` and `span_id` to every log line to correlate logs with traces.

**Where**
`/src/obs/log.ts`

**Implementation sketch**

* Pull active context (`trace.getSpan(context.active())`) and inject ids into log fields.

**Tests**
`/tests/sprint2/log_trace_correlation.spec.ts`: perform a request; capture logs; assert `trace_id` present and matches test span.

**Accept when**
Logs contain the current trace/span ids.

**Plain English**

> Every log line should point to its trace so we can click from logs to traces.

**LLM priming**
`context.active()`, `trace.getSpan`, `span.spanContext().traceId`

---

## Ticket-210 — Timeout traces & AbortController sanity

**What / Why**
When the upstream timeout fires, ensure we mark the span `ERROR`, call `AbortController.abort()`, and end the response exactly once. (Use MDN’s `AbortSignal.timeout` pattern.) ([MDN Web Docs][5])

**Where**
`/src/server/jungleClient.ts`, `server/proxy.ts`

**Implementation sketch**

* Wrap fetch with a timeout signal; catch `AbortError`; set span status; return JSON-RPC error.

**Tests**
`/tests/sprint2/timeout_abort_trace.spec.ts`: mock stall; assert single terminal response and span `ERROR`.

**Accept when**
No double-finalization; span shows timeout.

**Plain English**

> Don’t hang; mark the trace, abort, and finish cleanly.

**LLM priming**
`AbortSignal.timeout(ms)`, `catch (e) if e.name==='AbortError'`, `finally res.end()`

---

## Ticket-211 — README: TLS/mTLS handoff notes (infra)

**What / Why**
Document TLS termination and **mTLS** via ingress/mesh so ops can enable transport security (our app stays HTTP behind the proxy). ([expressjs.com][4])

**Where**
`README.md` (Security section)

**Implementation sketch**

* Recommend terminating TLS at gateway; enable **mTLS** in mesh/ingress between Orchestrator ⇄ Jungle; link to ops playbook.

**Tests**
`/tests/sprint2/tls_mtls_readme.spec.ts`: grep the README for “TLS”, “mTLS”, and ingress mention.

**Accept when**
Section exists with clear guidance.

**Plain English**

> Write down how to run this securely in production with TLS and mTLS.

**LLM priming**
`ingress TLS termination`, `service mesh mTLS`, `zero trust`, `network policy`

---

Absolutely—here are **Ticket-212** and **Ticket-213** promoted to **normal (non-optional)** Sprint 2 tickets, in the exact same style as the others. I’ve kept them small (10–30 min each), with file locations, tests, run instructions, a plain-English blurb, and an LLM priming block. Citations anchor the key practices/tools (RFC 6750 for Bearer, Supertest, Express security, and rate limiting).

---

## Ticket-212 — CI gate: ensure tests exercise Bearer auth

**What / Why**
Add a **hard CI check** so our test suite *actually* goes through the Bearer middleware. Prevents new routes or test helpers from silently bypassing auth. (Bearer per **RFC 6750**.) ([IETF Datatracker][1])

**Where**

* Test helper: `/src/testutils/supertestClient.ts`
* New test: `/tests/sprint2/ci_auth_header_gate.spec.ts`
* CI: `.github/workflows/ci.yml` (add a step that runs just this check on PRs)

**Implementation sketch**

* Create a thin Supertest wrapper `authClient(app, token)` that **always** sets `Authorization: Bearer <token>` for `/mcp` calls.
* In the gate test, make **one** Supertest call **without** the header to `/mcp` and assert the middleware returns a JSON-RPC error (or 401) so we know the gate is active.
* Update docstring in the helper: “Use `authClient` for all authenticated calls.”

**Tests**

* `/tests/sprint2/ci_auth_header_gate.spec.ts`

  * Case 1: `POST /mcp` **without** header → **fail** with JSON-RPC error (or 401).
  * Case 2: `authClient(app,'test-token')` → same call **passes** Bearer parse middleware.
* Supertest usage reference. ([npm][2])

**Accept when**

* The “no-auth request” test reliably fails (i.e., gets the expected error) and the “with auth” test passes.
* CI runs this gate test on every PR and blocks merges if it fails.

**Plain English**

> Make sure our tests really go through the token check. If a test forgets to send a token, we catch it in CI.

**LLM priming (keywords/APIs)**
`Supertest request(app)`, `set('Authorization','Bearer ...')`, `RFC 6750`, `401 vs JSON-RPC -32000`, `vitest --run`, `ci required job` ([IETF Datatracker][1])

---

## Ticket-213 — Minimal rate limiting around `/mcp`

**What / Why**
Add **basic IP rate limiting** to `/mcp` to reduce abuse and resource exhaustion; keep limits conservative for MVP. Use **express-rate-limit** (well-known Express middleware) and document defaults. ([npm][3])

**Where**

* Middleware: `/src/security/rateLimit.ts`
* Wire-up: `/src/server/http.ts` (apply limiter to `/mcp` route)
* Tests: `/tests/sprint2/rate_limit.spec.ts`

**Implementation sketch**

* Install: `npm i express-rate-limit`.
* Config (example): window = **60s**, limit = **60** requests per IP; standard 429 body `{ error: "rate_limited" }`.
* Ensure limiter runs **after** content-type/size checks but **before** proxying to Jungle.
* Mention alternative and best-practice refs in comments (Express docs, MDN blog). ([expressjs.com][4])

**Tests**

* `/tests/sprint2/rate_limit.spec.ts` using Supertest:

  * Send **limit** + 1 requests rapidly → last one returns **429**; body/message asserted.
  * Sleep for window and confirm it resets (or use `skipFailedRequests` config if preferred).
* (Supertest usage reference.) ([npm][2])

**Accept when**

* 429 is returned after the configured threshold; normal traffic under the threshold passes.
* Headers (e.g., `Retry-After` if configured) are set as expected.

**Plain English**

> Put a simple speed bump on `/mcp` so one client can’t hammer the API.

**LLM priming (keywords/APIs)**
`express-rate-limit`, `windowMs`, `max`, `handler(req,res)`, `status 429`, `Retry-After`, `Supertest` ([npm][3])

---

### How to run (Sprint 2)

```bash
npm i
# run only the new tickets’ tests (examples)
npm run test -- tests/sprint2/ci_auth_header_gate.spec.ts
npm run test -- tests/sprint2/rate_limit.spec.ts
```


---

## How to run tests locally (TypeScript)

```bash
npm i
# run only Sprint 2 tests
npm run test -- tests/sprint2
# run dev server
npm run dev
# optional: set OTLP endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

### Why these priming cues work

* They mirror **exact library/API names and code shapes** common in high-quality examples: Express route/middleware, Helmet usage, Zod schemas, JSON-RPC error codes, **OTel Node SDK** setup, `AbortSignal.timeout()` patterns, and Bearer token handling per **RFC 6750**. This steers a decoder-only LLM toward **idiomatic TS/Node** outputs while staying aligned with **OWASP** and **OpenTelemetry** guidance. ([expressjs.com][4])

If you want, I can also split these into **per-ticket Markdown files** with empty test stubs so Ticket-201 goes green as soon as you add the middleware.

[1]: https://owasp.org/API-Security/editions/2023/en/0x11-t10/?utm_source=chatgpt.com "OWASP Top 10 API Security Risks – 2023"
[2]: https://www.rfc-editor.org/info/rfc6750?utm_source=chatgpt.com "Information on RFC 6750"
[3]: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/?utm_source=chatgpt.com "Node.js"
[4]: https://expressjs.com/en/advanced/best-practice-security.html?utm_source=chatgpt.com "Security Best Practices for Express in Production"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static?utm_source=chatgpt.com "AbortSignal: timeout() static method - Web APIs - MDN - Mozilla"
[6]: https://swagger.io/docs/specification/v3_0/authentication/bearer-authentication/?utm_source=chatgpt.com "Bearer Authentication | Swagger Docs"
[7]: https://opentelemetry.io/docs/languages/js/instrumentation/?utm_source=chatgpt.com "Instrumentation"
