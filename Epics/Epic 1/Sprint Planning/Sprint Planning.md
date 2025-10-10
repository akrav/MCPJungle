# Sprint 0 — Foundations

**Goal**
Minimal MCP server skeleton that exposes `/mcp` over **Streamable HTTP**, completes `initialize`, and is containerized.

**Scope / Deliverables**

* Implement MCP server entrypoint with **JSON-RPC** framing; transport = **Streamable HTTP**. ([Model Context Protocol][1])
* Health endpoint, basic error envelope; Dockerfile; CI build.
* Minimal conformance: accept `initialize`, handle unknown methods cleanly.

**LLM priming cues (tools & terms)**

* Language: **Go** (good fit alongside MCPJungle), alt: **TypeScript**.
* Packages/terms: `net/http`, `context`, `encoding/json`, **JSON-RPC 2.0**, **Streamable HTTP**. ([Model Context Protocol][1])
* Endpoint: `POST /mcp` (server MCP endpoint).
* Container: `Dockerfile`, `docker compose up`.

**Exit Criteria**

* Agent connects to `/mcp` and completes `initialize` without errors.

**In plain English**

> Stand up the smallest possible server that says “hello” the MCP way over HTTP streams. It boots, answers `initialize`, and runs in Docker.

---

# Sprint 1 — Single-Upstream Pass-Through (MCPJungle)

**Goal**
Wire the orchestrator as a **thin proxy** to the user’s **per-user MCPJungle** instance; **no router, no catalog**—transparent IDs.

**Scope / Deliverables**

* On first use: **attach/spawn** the **per-user** MCPJungle gateway (treat Jungle as **the only upstream**).
* Proxy **discovery** and **invocation**: forward `tools/list` and `tools/call` to Jungle; stream responses back. ([Model Context Protocol][2])
* Keep request IDs **transparent**; basic failure mapping: upstream 4xx/5xx → MCP error objects.
* MCPJungle acts as the unified **registry/gateway** behind one `/mcp` endpoint. ([GitHub][3])

**LLM priming cues (tools & terms)**

* “**MCPJungle** = self-hosted **MCP Gateway/Registry**; one **/mcp** to discover tools and call them.” ([GitHub][3])
* Methods: `tools/list` (discover), `tools/call` (execute). ([Model Context Protocol][2])
* Env: `JUNGLE_URL`, `JUNGLE_TOKEN`, `ORCH_UPSTREAM_TIMEOUT_MS`.

**Exit Criteria**

* Agent lists and calls tools via our `/mcp`; Jungle performs all downstream routing.

**In plain English**

> Make our server a simple “pass-through door.” The agent talks to us; we relay to MCPJungle, which already knows all the tools and routes the calls.

---

# Sprint 2 — Security & Observability (beefed-up for MVP)

**Goal**
Real **AuthN/AuthZ** and **OpenTelemetry** from day one; minimal transport hardening.

**Scope / Deliverables**

* **AuthN**: Bearer/JWT on `/mcp`; bind request to user/tenant.
* **AuthZ**: pre-checks to prevent **BOLA** and function-level access issues (block cross-tenant IDs; allow-list methods). ([OWASP Foundation][4])
* **Transport**: TLS everywhere; if mesh/ingress available, enable **mTLS** (infra-level is fine).
* **Observability**: **OpenTelemetry** traces around `initialize`, `tools/list`, `tools/call`; export via OTLP to a collector; key dims: `user_id`, `tenant_id`, `tool_name`, `upstream_latency_ms`. ([OpenTelemetry][5])
* **Metrics**: request count, error rate, **P95 latency**; log–trace correlation.

**LLM priming cues (tools & terms)**

* OWASP API: **API1 BOLA** (object-level checks). ([OWASP Foundation][6])
* OTel: `Tracer`, spans, OTLP, **OpenTelemetry Collector**. ([OpenTelemetry][7])
* Config: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME=orchestrator`.

**Exit Criteria**

* Unauthorized blocked; traces confirm Agent → Orchestrator → Jungle path with latency metrics.

**In plain English**

> Lock the door and add windows. Only real users get in, and we can see what’s happening—where time is spent and where errors come from.

---

# Sprint 3 — Packaging & Dev/Stage Deploy

**Goal**
One-command local bring-up and a simple staging deploy with smoke tests.

**Scope / Deliverables**

* `docker-compose.yml` (or K8s manifest), health/readiness endpoints.
* CI/CD: build, push images; staging deploy.
* Smoke tests: `initialize`, `tools/list`, `tools/call` happy path.

**LLM priming cues (tools & terms)**

* “12-factor” env config; readiness/liveness probes; rolling or blue-green deploys.
* Artifacts: `deploy/staging.yaml`, `compose.yaml`, `Makefile`.

**Exit Criteria**

* Fresh machine to staging in one command; smoke tests green.

**In plain English**

> Make it easy to run and ship. One command to bring it up, and a small staging stack to test it.

---

# Sprint 4 — MVP Test & Stabilization (dedicated)

**Goal**
Reliability and failure-mode validation for the pass-through MVP.

**Scope / Deliverables**

* Concurrency & soak tests; chaos: **restart Jungle**, network blips, upstream 429/500.
* Contract tests for `tools/list` schema and `tools/call` streaming.
* “Getting Started” + Ops notes.

**LLM priming cues (tools & terms)**

* “golden path,” “retry with exponential backoff,” “circuit breaker,” “error budget.”
* Load tooling: **k6** or **vegeta**; artifacts under `tests/e2e/`.

**Exit Criteria**

* Lists/calls succeed under load; failure drills bounded; traces show stable P95.

**In plain English**

> Shake the table and make sure nothing falls. Lots of calls at once, some failures injected—system stays steady and understandable.

---

## Post-MVP (prioritized for production readiness)

# Sprint 5 — Hardening & Scale  *(moved up)*

**Goal**
Production readiness before any UI/extras.

**Scope / Deliverables**

* **mTLS** by default (mesh/ingress), **NetworkPolicies**, resource limits, autoscaling.
* Rate limiting, size caps, timeouts; connection pools; better rollbacks.
* SLO dashboards wired to OTel metrics. ([OpenTelemetry][8])

**LLM priming cues**

* “HPA/VPA,” “Istio/Linkerd mTLS,” “rate limit 429 with Retry-After,” “circuit-breaker trip percent.”

**Exit Criteria**

* SLO dashboards green under synthetic prod-like load.

**In plain English**

> Seatbelts and guardrails for real traffic: encrypt by default, control resource use, auto-scale, and watch clear SLOs.

---

# Sprint 6 — Admin Plane

**Goal**
Ops ergonomics for Jungle-backed pass-through.

**Scope / Deliverables**

* Minimal admin: **per-user Jungle status**, attach/detach, feature flags, read-only usage views.
* Treat Jungle as a **black box**—no code mods unless necessary. ([GitHub][3])

**LLM priming cues**

* “RBAC,” “audit log,” “feature flag gate.”

**Exit Criteria**

* Operators can inspect and unblock users without code edits.

**In plain English**

> A simple control panel to see user status and flip safe switches—no deep internals required.

---

# Sprint 7 — Router & Canonical Names *(only if/when needed)*

**Goal**
Introduce internal routing only if you add **multiple upstreams** or start transforming requests. Until then, **MCPJungle routes everything**. ([GitHub][3])

**Scope / Deliverables**

* `server__tool` naming; optional ID map if fan-out to more than Jungle.
* Keep single-upstream path unchanged.

**LLM priming cues**

* “transparent IDs,” “multi-upstream,” “correlate progress/cancel.”

**Exit Criteria**

* Multi-upstream ready; pass-through still clean for single upstream.

**In plain English**

> Only build our own traffic cop if we add more roads. With one road (Jungle), we don’t need it.

---

# Sprint 8 — Catalog Manager *(optional value add)*

**Goal**
Only if you later mix **local tools** with Jungle’s list.

**Scope / Deliverables**

* Merge local adapters into discovery; **TTL cache**; policy filters.
* Keep canonical names; respect dynamic listings. (MCP discovery = **list**, then **call**.) ([Model Context Protocol][2])

**LLM priming cues**

* `tools/list` merge pipeline, “TTL 60s,” “policy filter allow-list,” “lazy vs eager refresh.”

**Exit Criteria**

* Unified “menu” including local tools; faster discovery with cache hits.

**In plain English**

> If we add our own tools later, this neatly blends them with Jungle’s menu and caches the combined list for speed.

---

## Reference cues (for ticket generators)

* **MCPJungle**: self-hosted **MCP Gateway/Registry**; quickstart shows Docker Compose bring-up and connecting a client through one `/mcp`. ([GitHub][3])
* **MCP Tools**: discovery via `tools/list`, execution via `tools/call`. ([Model Context Protocol][2])
* **Transports**: stdio and **Streamable HTTP** are the standard MCP transports. ([Model Context Protocol][1])
* **Security**: OWASP **API1: BOLA** drives object-level checks. ([OWASP Foundation][4])
* **Observability**: **OpenTelemetry** traces/metrics via Collector (OTLP). ([OpenTelemetry][5])

If you want, I can drop this directly into your `Sprint Planning.md` with checkbox lists for “Exit Criteria” and a minimal test matrix for Sprints 2 & 4.

[1]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports?utm_source=chatgpt.com "Transports"
[2]: https://modelcontextprotocol.io/specification/2025-03-26/server/tools?utm_source=chatgpt.com "Tools"
[3]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "mcpjungle/MCPJungle: Self-hosted MCP Gateway and ..."
[4]: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/?utm_source=chatgpt.com "API1:2023 Broken Object Level Authorization"
[5]: https://opentelemetry.io/docs/specs/otel/overview/?utm_source=chatgpt.com "Overview"
[6]: https://owasp.org/API-Security/editions/2023/en/0x11-t10/?utm_source=chatgpt.com "OWASP Top 10 API Security Risks – 2023"
[7]: https://opentelemetry.io/docs/concepts/signals/traces/?utm_source=chatgpt.com "Traces"
[8]: https://opentelemetry.io/docs/?utm_source=chatgpt.com "Documentation"
