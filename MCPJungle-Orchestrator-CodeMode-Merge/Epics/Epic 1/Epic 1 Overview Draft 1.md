# Epic: MCP Orchestrator-as-a-Store (Gateway over MCPJungle)

> **One‑liner**: Build an MCP **orchestrator that is itself an MCP server**. It acts as a **Store/Gateway**: AI agents connect to one MCP endpoint and gain access to all tools registered in **MCPJungle** (and a local catalog). The orchestrator primarily **passes through** calls, with optional governance, metering, and value‑add features.

---

## Problem Statement

Today, AI agents must independently discover, configure, and authenticate dozens of MCP servers to access tools. This creates:

* Fragmented configuration across agents and teams.
* Inconsistent access control, logging, and auditability.
* Redundant effort to enable the same tools everywhere.

**We need a single MCP entry point**—an MCP “app store” and gateway that:

* Exposes **all tools** registered in MCPJungle under a unified, namespaced catalog.
* Allows **seamless install/enable/disable** per agent or tenant.
* Provides **governance** (authN/Z, quotas, approvals), **observability**, and optional **commerce** (free/paid tools).

---

## Goals & Non‑Goals

### Goals

1. **Gateway MCP Server**: Implements MCP Server (Streamable HTTP; optional STDIO) that proxies tool discovery and invocation to:

   * **MCPJungle** registry (remote Streamable HTTP MCPs and STDIO MCPs via MCPJungle).
   * **Local Catalog** (additional tools we define and expose).
2. **Pass‑Through First**: Minimal surface—forward discovery and tool invocations with canonical names; maintain fidelity of prompts/resources.
3. **Expandable Tooling**: Admin interface to **add custom tools** (manifests or adapters) that appear alongside MCPJungle‑sourced tools.
4. **Lightweight Governance Hooks**: Intercept lifecycle (initialize → capabilities → call → shutdown) for **authN/Z**, request‑ID mapping, and basic logging (no quotas or rate limits in this epic).
5. **Per‑User Segmentation**: On first use/installation, **spawn a segmented MCPJungle instance per user** for isolation; route that user’s requests exclusively through their instance.

### Non‑Goals (Phase 1 / MVP)

* No billing/commerce; anything payments- or pricing-related moves to a future epic.
* No quotas, rate-limits, or metered enforcement in this epic.
* No long‑running warm pools; stateless per-call is fine (aside from per-user MCPJungle instance lifecycle).
* No opinionated orchestration (e.g., auto tool chaining). Keep to pass‑through.

## High‑Level Architecture

```
+-------------------------+         +----------------------+
|  AI Agent (Client MCP)  |  --->   |  Orchestrator (MCP)  |  ----> MCPJungle (Gateway/Registry)
|  (Claude/Cursor/etc.)   |         |  (this project)      |        ├─ Streamable HTTP MCPs
+-------------------------+         |  • Streamable HTTP   |        └─ STDIO MCPs (spawned per call by MCPJungle)
                                    |  • Policy/Metrics    |
                                    |  • Catalog merge     |----> Local/Custom Tools (Adapters/Native)
                                    +----------------------+
```

**Flows**

1. **Discover**: Client connects to Orchestrator `/mcp`. Orchestrator aggregates capabilities from MCPJungle and local catalog; returns unified tool list (namespaced as `server__tool`).
2. **Invoke**: Client calls a tool via canonical name. Orchestrator validates policy, maps request IDs, forwards to the correct upstream (MCPJungle or local), streams responses back.
3. **Observe**: Orchestrator emits structured logs, spans, and usage records (per tenant/client/tool). Optional caching of tool schemas.

---

## Key Concepts

* **Canonical Tool Names**: `<serverName>__<toolName>` (double underscore) to avoid collisions.
* **Transport Support**:

  * **Streamable HTTP**: Primary transport between Client ⇄ Orchestrator ⇄ MCPJungle (and any HTTP MCPs we host).
  * **STDIO** (optional): For local tools, or dev mode.
* **Lifecycle Fidelity**: Preserve MCP lifecycle (initialize → capability negotiation → operate → shutdown). Forward progress/cancel.
* **Request‑ID Remapping**: Orchestrator must generate **unique per‑hop IDs** and maintain `inboundID ↔ upstreamID` mapping to route responses correctly.
* **Per‑User Segmentation**: Each user gets a dedicated MCPJungle instance for their session(s), providing isolation without quotas/rate limits.

---

## Components

1. **Gateway Server** (this project)

   * Streamable HTTP endpoint `/mcp` (TLS‑ready, behind reverse proxy).
   * **Registry Integrator**: syncs tool metadata from MCPJungle; exposes aggregate capabilities.
   * **Router**: resolves canonical names → upstream target; supports retries and backoff.
   * **Lightweight Policy**: authN/Z, ID remap, logging. (No quotas/rate limits.)
   * **Usage & Telemetry**: structured logs + OTEL traces + metrics (per tool and outcome).

2. **Catalog Manager**

   * **Sources**: (a) MCPJungle API, (b) Local config manifests, (c) Dynamic plugin loaders.
   * **Schema Store**: cache of tool schemas, prompts, and resource descriptors with ETags/versioning.
   * **Enablement**: per-user visibility (enabled tool list bound to that user’s segmented instance).

3. **Admin Plane**

   * **CRUD** for tools (add custom tools, edit metadata, retire versions).
   * **Access Control**: clients/users, tokens, roles, and basic allow/deny policies.
   * **Observability UI**: usage graphs and error heatmaps.

---

## MCP Integration Model

* **With MCPJungle**

  * Treat MCPJungle as the **system registry + proxy**.
  * On **first install/use by a user**, the orchestrator **spawns a segmented MCPJungle instance** for that user. All subsequent requests from that user are routed to their instance.
  * For HTTP MCPs: forward directly via that user’s MCPJungle instance.
  * For STDIO MCPs registered in MCPJungle: accept the overhead of **per‑call subprocess spawn** handled by the user’s MCPJungle instance; orchestrator remains stateless.
  * Cache **capabilities** (tool lists + schemas) with TTL per user‑instance to reduce fan‑out.

* **Local/Custom Tools**

  * Define a **tool manifest** (JSON/YAML) to register built‑in adapters (e.g., simple arithmetic, search proxy).
  * Adapter SDKs: Node/TS and Python helpers for quickly wrapping functions into MCP tools.

---

## Request Routing & ID Mapping

* **Inbound**: `request.id = client‑generated`. Map to `orchestrator‑rid` and store `{rid, clientId, tenantId, upstream, tool}`.
* **Outbound to MCPJungle**: generate `upstream‑rid`. Store `{orchestrator‑rid ↔ upstream‑rid}`.
* **Response**: translate `upstream‑rid → orchestrator‑rid → client‑rid` while streaming parts (progress, logs, errors) 1:1.
* **Safety**: enforce **idempotency keys** for retries; drop orphaned responses; timeout + cancellation propagation.

---

## Security & Governance

* **AuthN**: Bearer tokens for clients; optional mTLS for service‑to‑service.
* **AuthZ**: Basic RBAC/ABAC policies on tools and servers (allowlists/denylists per user). No quotas/rate‑limits in this epic.
* **Secrets**: Never inline secrets into prompts; use scoped secret stores or MCPJungle’s mechanisms.
* **Data Controls**: Prompt/result redaction, PII scanning, log scrubbing; configurable retention.
* **Isolation Model**: **Per‑user segmented MCPJungle instance** ensures isolation without rate control.

---

## Observability

* **Structured Logs**: Every call with correlation IDs, tool, user, latency, size.
* **Metrics**: QPS, latency histograms, error codes, success rate, spawn time (when applicable via MCPJungle), retry counts.
* **Tracing**: OTEL spans across Client → Orchestrator → *User’s* MCPJungle → Tool server.

---

## Data Model (MVP)

* **User**: `{ id, name, roles[], allowedTools[] }`
* **Server**: `{ name, transport, description, url?, command?, args?, tags[], status }`
* **Tool**: `{ canonicalName, serverName, schema, version, tags[], enabled, visibility }`
* **UsageRecord**: `{ ts, userId, clientId, tool, inputBytes, outputBytes, durationMs, status }`

---

## Interfaces

### 1) MCP Endpoint

* `POST /mcp` (Streamable HTTP). Implements MCP Server lifecycle and passes through.

### 2) Admin API (draft)

* `POST /admin/tools` — register local tool (manifest or adapter package ref).
* `PATCH /admin/tools/{canonicalName}` — enable/disable, visibility, tags.
* `POST /admin/users` — create users and tokens; bind each to a segmented MCPJungle instance.
* `GET /admin/usage` — usage metrics (time‑windowed).

### 3) Instance Lifecycle API (internal)

* `POST /internal/instances` — spawn segmented MCPJungle for a user.
* `DELETE /internal/instances/{userId}` — optional teardown after inactivity.

---

## Example Config (Local Tool Manifest)

```yaml
# tools/example.add.yaml
name: example__add
kind: function
lang: node
entry: tools/example.add.ts
schema:
  input:
    type: object
    properties:
      a: { type: number }
      b: { type: number }
    required: [a, b]
  output:
    type: object
    properties:
      sum: { type: number }
```

---

## Deployment Options

* **Dev**: Single container with Orchestrator; **per‑user MCPJungle instances** via Docker Compose (one service per user) or subprocess with isolated config; SQLite or Postgres for state; OTEL to local collector.
* **Prod**: Orchestrator behind API gateway (TLS, WAF); per‑user MCPJungle instances managed by an orchestrator (Kubernetes or Nomad) with network isolation; mTLS between services; OTEL to managed backend; autoscale on CPU/RPS.

---

## Risks & Mitigations

* **Instance Sprawl**: Per‑user instances can multiply → add inactivity TTL and garbage‑collection; support shared read‑only catalogs to reduce memory.
* **Latency Fan‑Out**: Aggregating capabilities across many servers → cache with TTL; lazy fetch tool schemas on first use.
* **STDIO Cold Starts**: Per‑call spawn overhead → acceptable for MVP; later consider warm pools in a future epic.
* **Request‑ID Collisions**: Strict remapping with UUIDv7; robust cleanup on cancel.
* **Version Skew**: Track MCP revision strings; negotiate to the highest mutually supported.

---

## MVP Scope & Acceptance Criteria

* ✅ Orchestrator exposes a working `/mcp` endpoint; Claude/Cursor can connect and list tools.
* ✅ On first install/use, **a new segmented MCPJungle instance is created per user** and wired to the orchestrator.
* ✅ Catalog lists and proxies **all tools from the user’s MCPJungle instance** (HTTP & STDIO) plus at least **one local tool**.
* ✅ Canonical naming and routing works (`server__tool`).
* ✅ Request‑ID remap functional across progress/cancel/logs.
* ✅ Basic authN/Z and request logs with correlation IDs.

---

## Future Work

* **Commerce/Billing**: Price plans, paid tool unlocks, purchase workflows, revenue share. *(Future epic.)*
* **Warm Pools**: Keep selected downstream servers warm (HTTP keep‑alive, or MCPJungle hints).
* **Declarative Policies**: OPA/Rego or Cedar integration.
* **Content Safety**: Prompt and output classifiers.
* **Admin UI**: User admin, tool browsing, usage insights, cost forecasts.

---

## Open Questions

1. What’s the default inactivity TTL and teardown policy for per‑user MCPJungle instances?
2. Should we allow a user to opt into a **shared** read-only MCPJungle instance for low-usage cases?
3. Minimal schema for local tool manifests to cover 80% of adapters?
4. How do we reconcile tool versions and deprecations across per-user MCPJungle instances and local entries?

---

## High‑Concept Approaches (Cheat Sheet)

* **“Store as a Gateway”**: Keep orchestration thin; push lifecycle and spawning to **per‑user MCPJungle instances**; add policy and catalog only.
* **“Manifest‑First Local Tools”**: No codegen required to expose internal utilities; small adapter SDKs.
* **“Observability by Default”**: Every call emits structured telemetry; correlations across the full path.
* **“Auth Minimalism”**: Basic authN/Z only; *no* quotas/rate limits in MVP.

---

## Appendix: Implementation Notes

* Use UUIDv7 (time‑sortable) for request IDs; bounded in‑memory map with TTL and optional Redis for HA.
* Async stream relaying (backpressure‑aware) to preserve streaming semantics.
* Normalize tool schemas on ingest; store ETags; diff on catalog refresh to avoid churn.
* Respect MCP revision negotiation (prefer latest; down‑level gracefully).
* Provide a `dry‑run` flag to simulate calls (approval flows can come later).

---

## Per‑User Segmented Flow (Step‑by‑Step)

1. **User downloads the MCP Orchestrator.**
2. **AI agent requests install of an MCP from the Store** (pings the orchestrator, which manages MCPJungle).
3. **Orchestrator creates a new segmented MCPJungle instance for the user**, then **loads the requested MCP** into that instance.
4. **User’s AI agent invokes tools via the orchestrator**, which routes to the user’s MCPJungle instance.
5. **When the agent is finished, that’s it** — the instance remains until TTL expires or is explicitly torn down, per the lifecycle policy.
