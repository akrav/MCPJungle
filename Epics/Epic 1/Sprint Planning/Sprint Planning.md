Sweet—here’s a clean, dependency-aware sprint plan to build your **Epic 1: MCP Orchestrator-as-a-Store (Gateway over MCPJungle)**. I’ve ordered the sprints so each one unlocks the next, and I included crisp outcomes and exit criteria.

---

# Sprint 0 — Protocol & Skeleton (foundations)

**Objective**
Stand up a minimal, spec-compliant MCP **server** (Streamable HTTP) that answers `/mcp` and can be used by an AI agent client. Lay down repo structure, config, tests.

**Why first**
Everything else (catalog merge, routing, auth) builds on a correct MCP server and transport. Streamable HTTP is the current standard transport to target first. ([Model Context Protocol][1])

**Key tasks**

* Create repo + CI; choose language/runtime.
* Implement MCP **Streamable HTTP** endpoint (`POST /mcp`) with init → capability negotiation → operate → shutdown lifecycle stubs. ([Model Context Protocol][1])
* Add STDIO support *only* for dev if needed (nice-to-have). ([Model Context Protocol][2])
* Build a tiny conformance test harness (golden JSON-RPC transcripts).

**Deliverables**

* Running server exposing `/mcp`, returning a trivial empty tool list.
* Basic unit/integration tests pass.

**Exit criteria**

* A client (e.g., Claude/Cursor) connects and completes `initialize` without errors.

---

# Sprint 1 — Per-User MCPJungle Instance Manager

**Objective**
Implement the **segmented per-user instance** lifecycle for MCPJungle: create on first use, wire to orchestrator, and manage teardown (TTL). Your orchestrator should route each user exclusively to their instance.

**Why now**
Per-user isolation is a core product behavior and informs how we store catalogs, cache capabilities, and wire routing. The MCPJungle contract is the backbone. ([GitHub][3])

**Key tasks**

* Add **Instance Manager** module: `create(user)`, `status(user)`, `stop(user)` with TTL/GC policy.
* Compose/launch MCPJungle per user (Docker Compose, subprocess, or K8s Job/Deployment; start with Compose for dev).
* Health checks and readiness gating before exposing the instance.

**Deliverables**

* API: `POST /internal/instances` (spawn), `GET /internal/instances/:userId` (status).
* Config templates for per-user MCPJungle.

**Exit criteria**

* On first agent request: a dedicated MCPJungle instance is spawned and reachable via the orchestrator.

---

# Sprint 2 — Catalog Aggregation & Canonical Naming

**Objective**
Merge **capabilities** from the user’s MCPJungle instance (and local tools) into a unified, namespaced catalog; cache schemas with TTL.

**Why now**
Clients need a stable tool list. Canonical names (`server__tool`) and capability caching reduce latency and flapping as instances come/go. ([GitHub][3])

**Key tasks**

* Add **Catalog Manager** that queries MCPJungle for registered servers/tools; merge with local manifests.
* Implement **canonical names**: `<serverName>__<toolName>`.
* TTL cache for tool schemas/resources/prompts.

**Deliverables**

* `/mcp` `capabilities` includes the merged, namespaced tool list.
* Cache invalidation knobs (ETag/hash or timestamp).

**Exit criteria**

* Client lists tools with canonical names; cache hit observed on repeat discovery.

---

# Sprint 3 — Request Routing, ID Remapping, Progress/Cancel

**Objective**
Make the orchestrator a **transparent pass-through** for tool calls with **request-ID mapping** across hops and proper streaming of progress/cancel/logs.

**Why now**
Correct routing & ID mapping is essential for reliability and later observability. Time-sortable UUIDv7 IDs help with traceability in logs. ([IETF Datatracker][4])

**Key tasks**

* Router resolves `server__tool` → target server (via user’s MCPJungle).
* Generate **UUIDv7** per hop; maintain `{clientRid ↔ orchRid ↔ upstreamRid}` map with TTL.
* Pass through **progress/cancel** and errors 1:1 (preserve lifecycle semantics). ([Model Context Protocol][1])
* Idempotency keys for safe retries.

**Deliverables**

* Request/response correlation works across the full path.
* Integration tests: multi-tool call sequence with cancel mid-flight.

**Exit criteria**

* Tool invocation round-trips with correct correlation IDs and clean cancel behavior.

---

# Sprint 4 — AuthN/Z (minimal) & Observability (OTel)

**Objective**
Add **bearer-token** auth and minimal RBAC/ABAC allowlists. Instrument the orchestrator with **OpenTelemetry** traces/metrics/logs and correlation IDs.

**Why now**
Before exposing admin and multi-user flows, you need basic security and the ability to **see** what’s happening. ([Model Context Protocol][5])

**Key tasks**

* HTTP auth for Streamable HTTP (bearer token), user extraction, per-user allowlists. ([Model Context Protocol][5])
* OTel tracing around: `/mcp` init, capability fetch, tool call, MCPJungle instance ops. ([OpenTelemetry][6])
* Emit basic metrics (QPS, latency, error rate); wire to collector/back-end. ([OpenTelemetry][7])

**Deliverables**

* Auth middleware; signed test tokens.
* Traces visible end-to-end; metrics dashboards with latency histograms.

**Exit criteria**

* Unauthorized requests are rejected; authorized flows appear in traces with proper spans and attributes.

---

# Sprint 5 — Admin Plane & Local Tool Manifests

**Objective**
Expose the **Admin API** to register local tools, toggle visibility, and inspect usage; load **local tool manifests** and surface them alongside MCPJungle tools.

**Why now**
After routing & security exist, admins can safely extend the catalog without touching MCPJungle. This also enables MVP “add tools that can be exposed.”

**Key tasks**

* Admin endpoints:
  `POST /admin/tools`, `PATCH /admin/tools/{canonicalName}`, `POST /admin/users`, `GET /admin/usage`.
* Manifest loader (JSON/YAML) + schema validation; hot-reload support.
* Usage aggregation view (powered by OTel spans/metrics). ([OpenTelemetry][8])

**Deliverables**

* Sample local adapter tool (e.g., `example__add`) available in catalog.
* Basic admin CLI or Postman collection.

**Exit criteria**

* Admin can add a tool, enable it for a user, and see it show up in the user’s tool list.

---

# Sprint 6 — Deployment Profiles & Hardening

**Objective**
Package **dev** (Docker Compose) and **prod** (Kubernetes/Nomad) profiles, including per-user MCPJungle instance management, TLS, and basic WAF/gateway posture.

**Why now**
You have functionality; now you need repeatable deployment + isolation that scales. MCPJungle provides CLI/taps and is amenable to containerized workflows. ([GitHub][9])

**Key tasks**

* Dev: 1 orchestrator container + on-demand per-user MCPJungle containers (compose) with shared network.
* Prod: K8s manifests for orchestrator + controller for per-user MCPJungle instances; service accounts, network policies, mTLS between services.
* Resource limits & liveness/readiness probes.

**Deliverables**

* `docker-compose.yml` and K8s Helm chart/manifests.
* Docs for Ops (rotate tokens, logs/metrics endpoints).

**Exit criteria**

* One-command local bring-up; successful smoke test in a staging cluster.

---

# Sprint 7 — MVP Stabilization & Acceptance

**Objective**
Hit all **MVP acceptance criteria** end-to-end with soak tests, failure drills, and documentation.

**Why now**
This locks the epic. It validates the “store/gateway” experience and per-user isolation under load.

**Key tasks**

* Soak tests for latency fan-out (capability TTL cache) and STDIO cold starts; measure + tune. (Recall: STDIO servers are often spawned per call by an upstream; you accept that cost in MVP.) ([Model Context Protocol][2])
* Chaos drills: kill a per-user MCPJungle instance; verify recovery.
* Write the “Getting Started” and “Admin Ops” docs.

**Deliverables**

* Test report with p50/p95 latencies and error budgets.
* Final docs + sample configs.

**Exit criteria (mirrors epic MVP)**

* Agent connects to `/mcp`, lists tools, and successfully calls tools via the **user’s** MCPJungle instance.
* Canonical naming, ID remap, auth, and logs are all verified.

---

## Dependencies & Rationale (at a glance)

* **Sprint 0** must precede everything (protocol compliance). ([Model Context Protocol][1])
* **Sprint 1** (per-user instances) informs catalog scoping & routing choices (Sprints 2–3). ([GitHub][3])
* **Sprint 2** (catalog) needs instances alive to fetch per-user capabilities.
* **Sprint 3** (routing/IDs) builds on catalog names and per-user wiring; UUIDv7 aids logs/ordering. ([IETF Datatracker][4])
* **Sprint 4** (auth/OTel) depends on correct call flow to instrument. ([Model Context Protocol][5])
* **Sprint 5** (admin plane) is safe once auth + routing work.
* **Sprint 6–7** finalize operations & acceptance.

---

## Notes & references you’ll care about

* **MCPJungle** = gateway/registry that centralizes MCP servers and exposes tools from one server; it’s installable via Homebrew and oriented toward enterprise agents. ([GitHub][3])
* **MCP transports** = Streamable HTTP (current recommendation) and STDIO (fast local); know tradeoffs and pick Streamable HTTP as the baseline. ([Model Context Protocol][1])
* **Observability** = OpenTelemetry traces + metrics for end-to-end visibility; correlate spans through your request-ID map. ([OpenTelemetry][6])
* **IDs** = UUIDv7 provides time-sortable IDs that make logs and caches friendlier. ([IETF Datatracker][4])

If you want, I can turn this into a **Jira-ready sprint board** (tickets with DoD and test notes) or add a **docker-compose** starter that spins the orchestrator + a mock per-user MCPJungle instance for local testing.

[1]: https://modelcontextprotocol.io/specification/draft/basic/transports?utm_source=chatgpt.com "Transports"
[2]: https://modelcontextprotocol.io/docs/concepts/architecture?utm_source=chatgpt.com "Architecture overview"
[3]: https://github.com/mcpjungle/MCPJungle?utm_source=chatgpt.com "Self-hosted MCP Gateway and Registry for AI agents"
[4]: https://datatracker.ietf.org/doc/html/draft-ietf-uuidrev-rfc4122bis-14?utm_source=chatgpt.com "draft-ietf-uuidrev-rfc4122bis-14"
[5]: https://modelcontextprotocol.io/specification/2025-06-18/basic?utm_source=chatgpt.com "Overview"
[6]: https://opentelemetry.io/docs/specs/otel/overview/?utm_source=chatgpt.com "Overview"
[7]: https://opentelemetry.io/docs/?utm_source=chatgpt.com "Documentation"
[8]: https://opentelemetry.io/docs/specs/otel/metrics/?utm_source=chatgpt.com "OpenTelemetry Metrics"
[9]: https://github.com/mcpjungle/homebrew-mcpjungle?utm_source=chatgpt.com "Homebrew Tap for MCPJungle"
