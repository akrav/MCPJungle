# Sprint 0 — CodeMode Integration Spike (Orchestrator + Jungle)

**Goal**  
Prove end-to-end Code Mode execution via the Orchestrator against a user’s MCPJungle tools with a tiny subset (2–3 tools).

**Scope / Deliverables**

* Wire `codemode-standalone` into the Orchestrator process (no new engine).
* Use `MCPClient` + `MCPToolConverter` against a dev user’s MCPJungle to obtain tools.
* Run a single mini-program (no streaming required) and return atomic `{ code, result }` with basic logs.

**LLM priming cues (tools & terms)**

* “Convert tools to a TypeScript API, emit code-only, execute in sandbox.” ([Cloudflare Code Mode][1])
* MCP calls: `tools/list`, `tools/call`. ([Model Context Protocol][2])

**Exit Criteria**

* Orchestrator executes a model-emitted async function that calls ≥2 tools via the user’s MCPJungle and returns `{ code, result }`.

**In plain English**

> Get a thin demo working: the model writes a small function, we run it in a sandbox, and it calls two real tools through Jungle.

---

# Sprint 1 — Typed Tool Surface + Prompt Contract (reuse generator)

**Goal**  
Expose the user’s MCPJungle catalog as a stable, typed `codemode` API and ship the minimal “emit code only” prompt.

**Scope / Deliverables**

* Integrate `TypeGenerator` from `codemode-standalone` to emit `declare const codemode: { "server__tool": (input) => Promise<Output> }` from Jungle tool schemas (JSON Schema/Zod).
* Maintain canonical naming (`server__tool`), and use existing schema hashing/ETag/versioning strategy from the generator.
* Ship compact prompt: “emit code only; single async function; use `codemode`.”

**LLM priming cues**

* JSON Schema → TS (`json-schema-to-typescript`); Zod → TS (`zod-to-ts`).
* Canonical naming mirrors orchestrator routing.

**Exit Criteria**

* Typings generated for ≥10 tools from a user’s catalog; prompt + surface validated on simple requests.

**In plain English**

> Hand the model a clean, typed toolbox and a tiny instruction card so it writes small, correct code.

---

# Sprint 2 — Locked-Down Sandbox Runtime (reuse isolate)

**Goal**  
Run code in an isolated, permissionless runtime with strict caps (time/memory/output) and no ambient network.

**Scope / Deliverables**

* Adopt `IsolatedExecutor` from `codemode-standalone` (per-execution isolate already implemented); inject only the `codemode` proxy binding from the orchestrator.
* Configure `SecurityPolicy` to enforce limits: max execution time, memory cap, output size, max tool calls; `allowNetworkAccess=false`.
* Deny ambient `fetch`/fs/env/timers/crypto—only orchestrator bindings allowed (no new runtime to build).

**LLM priming cues**

* “Per-execution isolate,” “no network by default,” “minimal bindings.” ([Cloudflare Code Mode][1])

**Exit Criteria**

* Attempts to access globals fail; limits enforced; violations return `LimitExceeded` errors.

**In plain English**

> Give the code a tiny, safe room to run in—only our toolbox is accessible, and it times out quickly if it misbehaves.

---

# Sprint 3 — Proxy Bridge Orchestrator → MCPJungle (Streaming + Cancel)

**Goal**  
Translate `codemode.<fn>(args)` calls into MCP tool invocations via the user’s MCPJungle instance with streaming and cancellation.

**Scope / Deliverables**

* JSON-RPC-like bridge `{ fn, args }` → resolve `server__tool` → forward to Jungle `tools/call`.
* Preserve request-ID mapping, stream chunks back, propagate `cancel` cleanly.
* Input validation vs generated schemas; concise field-level diagnostics on failure.

**LLM priming cues**

* MCP `tools/list`/`tools/call` semantics; ID correlation; stream relaying.

**Exit Criteria**

* Multi-step run calling ≥2 tools succeeds with streaming and cancel; traces show end-to-end correlation.

**In plain English**

> Wire the toolbox calls to Jungle so they act like normal MCP calls, including streams and cancel.

---

# Sprint 4 — Observability & Security Controls (MVP)

**Goal**  
Instrument Code Mode runs and enforce guardrails.

**Scope / Deliverables**

* Metrics: code-gen time, compile time, eval time, tool-call counts, p50/p95.
* Traces: compile → eval → each tool call; correlation IDs across Orchestrator ↔ Jungle ↔ MCP.
* Optional code persistence (off by default), redacted, keyed by code hash.

**LLM priming cues**

* OpenTelemetry spans/counters/histograms; correlation IDs.

**Exit Criteria**

* Dashboards show Code Mode KPIs and end-to-end traces; guardrails observed in tests.

**In plain English**

> See what’s happening under the hood and keep runs inside safety lines.

---

# Sprint 5 — Routing Abstraction (Shared Jungle vs Per-User Instance)

**Goal**  
Add a routing layer that supports both a shared multi-tenant Jungle and optional per-user Jungle instances (feature-flagged).

**Scope / Deliverables**

* Upstream router: resolve Jungle endpoint per request.
* Backends: (a) shared `JUNGLE_URL` (default), (b) per-user mapping `userId → jungleBaseUrl`.
* Config/flags to toggle modes without changing client contracts.

**LLM priming cues**

* “Routing abstraction,” “feature flag,” “per-tenant config.”

**Exit Criteria**

* Both backends validated in tests; default remains shared multi-tenant Jungle.

**In plain English**

> Make the upstream pluggable so we can flip between one shared Jungle and per-user instances later.

---

# Sprint 6 — Per-User Jungle Provisioning (Optional Isolation)

**Goal**  
Provision and manage dedicated Jungle instances per user/tenant when required (compliance/isolation), behind a feature flag.

**Scope / Deliverables**

* Provisioning adapter (Docker/K8s/VM) with health checks.
* State: `userId → jungleBaseUrl` map with TTL, reuse, teardown/GC on inactivity.
* Fallback: if provisioning fails, optionally route to shared Jungle (configurable).

**LLM priming cues**

* “Instance lifecycle,” “TTL/GC,” “health checks,” “fallback routing.”

**Exit Criteria**

* A tenant can be switched to isolated mode; instances recycle on inactivity; observability shows cold-start time and usage.

**In plain English**

> For customers who need hard isolation, spin up their own Jungle and keep it tidy.

---

# Sprint 7 — Hardening, Soak, and Docs

**Goal**  
Stabilize with load/chaos tests and ship docs/runbooks.

**Scope / Deliverables**

* Soak: many short Code Mode runs composing 2–4 tools; compare token/latency vs direct calling.
* Chaos: kill/restart Jungle mid-run; verify crisp errors and sandbox containment.
* Docs/runbooks: operator flows for both modes; developer quickstart; example gallery.

**LLM priming cues**

* “retry with exponential backoff,” “circuit breaker,” “error budget,” “SLOs.”

**Exit Criteria**

* Steady p95 latencies, clean failure behaviors, and complete docs.

**In plain English**

> Beat on it like production and make sure it’s understandable and fixable.

---

## Reference cues (for ticket generators)

* **Code Mode concept**: convert tools → TS API; model emits code; execute in isolate. ([Cloudflare Code Mode][1])
* **MCP Tools**: discover via `tools/list`, execute via `tools/call`. ([Model Context Protocol][2])
* **MCPJungle**: per-user catalog behind one `/mcp` gateway; default shared deployment. ([GitHub][3])
* **Security**: no ambient network in sandbox; strict caps; feature-flag per-user Jungle.
* **Observability**: OTEL spans & metrics; correlation IDs across all hops.

[1]: https://blog.cloudflare.com/code-mode/
[2]: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
[3]: https://github.com/mcpjungle/MCPJungle


