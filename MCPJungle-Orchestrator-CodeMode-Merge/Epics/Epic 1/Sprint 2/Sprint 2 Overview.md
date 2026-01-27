# Sprint 2 — Security & Observability (beefed-up MVP) — Updated

**Goal**
Ship real **AuthN/AuthZ** and **OpenTelemetry** from day one. Add secure headers, strict JSON limits, request rate-limit, log/trace correlation, and TLS/mTLS guidance—while keeping pass-through behavior to MCPJungle unchanged. 

**Rule of engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**.

**Repo (S2 adds/updates)**

```
/orchestrator
  /src
    server/{http.ts,proxy.ts,initialize.ts,jungleClient.ts}
    auth/{bearer.ts,authorize.ts}
    security/{helmet.ts,limits.ts,rateLimit.ts}
    obs/{otel.ts,log.ts}
    config/{schema.ts,load.ts}
    jsonrpc/{types.ts,validate.ts,errors.ts}
    health/healthz.ts
  /tests/sprint2
    bearer_parse.spec.ts
    authz_allowlist.spec.ts
    security_middleware.spec.ts           # ← merged (headers + size/type)
    trace_init.spec.ts
    trace_list_call.spec.ts
    trace_error_and_timeout.spec.ts       # ← merged (error map + timeout)
    metrics_histograms.spec.ts
    log_trace_correlation.spec.ts
    ci_auth_header_gate.spec.ts
    rate_limit.spec.ts
    tls_mtls_readme.spec.ts
  /deploy (unchanged for S2)
  README.md (Security, TLS/mTLS)
  .github/workflows/ci.yml (updated)
```

---

## Ticket-201 — Bearer token parsing (AuthN middleware)

**What / Why**
Parse `Authorization: Bearer <token>` and attach auth context to `res.locals`. Missing token → JSON-RPC `-32000` (or 401), per **RFC 6750**. 

**Where**
`/src/auth/bearer.ts` (wired early in `server/http.ts`)

**Tests**
`bearer_parse.spec.ts`: no header → error; with header → `res.locals.auth.token="..."`.

**LLM priming**
`Authorization: Bearer`, `RFC 6750`, `res.locals`, `next()`.

---

## Ticket-202 — Method allow-list (AuthZ guard)

**What / Why**
Block unknown JSON-RPC methods; allow only `{initialize, tools/list, tools/call, cancel}` to reduce **API1 / API3** exposure. 

**Where**
`/src/auth/authorize.ts` (middleware before proxy)

**Tests**
`authz_allowlist.spec.ts`: allowed pass; others → `-32601`.

**LLM priming**
`switch(method)`, `-32601`, `least privilege`.

---

## Ticket-203 — **Security middleware**: Helmet + JSON size/type guard  *(merged)*

**What / Why**
Add **Helmet** headers and enforce `Content-Type: application/json` with **1 MB** body limit. Keeps inputs sane and streaming safe. 

**Where**
`/src/security/helmet.ts`, `/src/security/limits.ts` (wire in `server/http.ts`)

**Tests**
`security_middleware.spec.ts`:

* `GET /healthz` has `X-Content-Type-Options: nosniff` etc.
* Oversized / wrong content-type → `-32600 InvalidRequest`.

**LLM priming**
`helmet()`, `express.json({limit:'1mb'})`, `req.is('application/json')`.

---

## Ticket-204 — OpenTelemetry bootstrap (Node SDK)

**What / Why**
Set up **OTLP exporters** for traces/metrics, auto-instrument `http` and `undici`; `Resource.service.name="orchestrator"`. 

**Where**
`/src/obs/otel.ts` (called from startup in `server/http.ts`)

**Tests**
`trace_init.spec.ts`: request emits a root span in a test exporter.

**LLM priming**
`@opentelemetry/sdk-node`, `OTLPTraceExporter`, `Resource`.

---

## Ticket-205 — Spans for `initialize`, `tools/list`, `tools/call`

**What / Why**
Name spans and set attributes (`user_id`, `tenant_id`, `tool_name`, `upstream_latency_ms`), status on error. 

**Where**
Wrap handlers in `server/http.ts` / `server/proxy.ts`.

**Tests**
`trace_list_call.spec.ts`: spans exist with attributes.

**LLM priming**
`tracer.startSpan(...)`, `span.setAttribute`, `SpanStatusCode.ERROR`.

---

## Ticket-206 — **Trace correctness on failures** (error map + timeout)  *(merged)*

**What / Why**
When upstream fails (HTTP 5xx / non-JSON-RPC) or **timeout** occurs, mark span `ERROR`, add `error.type`, `http.status_code`, and return JSON-RPC `-32000`. Also ensure **AbortController** is used and responses end **exactly once**. 

**Where**
`/src/server/proxy.ts`, `/src/server/jungleClient.ts`

**Tests**
`trace_error_and_timeout.spec.ts`:

* Force 502 → span `ERROR` + mapped envelope.
* Force stall → timeout triggers abort; single terminal response.

**LLM priming**
`AbortSignal.timeout(ms)`, `catch AbortError`, `error.data.status`.

---

## Ticket-207 — Metrics: counters & histograms

**What / Why**
Emit `requests_total`, `errors_total`, and `request_duration_ms` histogram. 

**Where**
`/src/obs/otel.ts` (Meter), record in `http.ts`/`proxy.ts`.

**Tests**
`metrics_histograms.spec.ts`: instruments update deterministically.

**LLM priming**
`meter.createCounter`, `createHistogram`, `record(ms)`.

---

## Ticket-208 — Log ↔ trace correlation

**What / Why**
Inject `trace_id`/`span_id` into every log line from active context to correlate logs→traces. 

**Where**
`/src/obs/log.ts`

**Tests**
`log_trace_correlation.spec.ts`: captured logs include `trace_id` matching the test span.

**LLM priming**
`context.active()`, `trace.getSpan()`, `spanContext()`.

---

## Ticket-209 — TLS/mTLS handoff notes (README)

**What / Why**
Document TLS termination and **mTLS** in ingress/mesh so ops can secure transport; app stays HTTP behind proxy. 

**Where**
`README.md` (Security section)

**Tests**
`tls_mtls_readme.spec.ts`: grep for “TLS”, “mTLS”, ingress/mesh mention.

**LLM priming**
`ingress TLS termination`, `service mesh mTLS`.

---

## Ticket-210 — CI gate: tests must exercise Bearer

**What / Why**
Add a **hard CI check** so tests don’t bypass Bearer middleware; use a tiny Supertest wrapper that always sets the header in authenticated calls. 

**Where**
`/src/testutils/supertestClient.ts`, `.github/workflows/ci.yml`

**Tests**
`ci_auth_header_gate.spec.ts`: call `/mcp` once **without** header → expected error; with header → OK.

**LLM priming**
`Supertest request(app)`, `set('Authorization','Bearer …')`, `required CI job`.

---

## Ticket-211 — Minimal rate limiting around `/mcp`

**What / Why**
Add **express-rate-limit** at `/mcp` to reduce abuse; conservative defaults. 

**Where**
`/src/security/rateLimit.ts` (wired in `server/http.ts`)

**Tests**
`rate_limit.spec.ts`: send (limit + 1) requests fast → last gets **429**; reset after window.

**LLM priming**
`express-rate-limit`, `windowMs`, `max`, `Retry-After`.

---

## How to run Sprint 2 tests locally

```bash
npm i

# Run only Sprint 2 tests
npm run test -- tests/sprint2

# Optional: set OTLP endpoint to see spans/metrics
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
npm run dev
```

---

### Why these priming cues work

They mirror the exact APIs and best-practice vocab you’re already using—**Bearer per RFC-6750**, **OWASP API** allow-listing, **Helmet** + strict JSON parsing, **OpenTelemetry** Node SDK (traces/metrics), **AbortSignal.timeout**—nudging the model toward **idiomatic TS/Node** while keeping the proxy contract intact. 

If you want, I can also drop tiny **skeleton files** (headers + TODO asserts) so several of these tickets go green with near-zero extra calls.
