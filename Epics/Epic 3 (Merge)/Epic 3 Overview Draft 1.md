# Epic 3: Merge Orchestrator with Code Mode (Per‑User MCPJungle)

> One‑liner: Add a Code Mode execution layer to the Orchestrator so agents can run short, typed programs that call the user’s MCPJungle tools (Weather, Apple App Store, Amazon Music, etc.) with fewer LLM round‑trips, better reliability, and strong isolation.

---

## Context (from Epic 1 and Epic 2)

- Epic 1 delivered an Orchestrator that is an MCP server and gateway, forwarding JSON‑RPC calls to a per‑user MCPJungle instance (the “app store”/registry of many MCPs).
- Epic 2 delivered a Code Mode layer (standalone) that turns MCP tools into a TypeScript API and executes LLM‑authored code in a sandbox, enabling multi‑step flows with less token overhead and higher reliability.

This epic merges both: the Orchestrator will provide a Code Mode execution path that binds the calling user’s MCPJungle catalog as typed functions, executes the agent’s mini‑program in a per‑execution sandbox, and proxies tool invocations through MCPJungle.

---

## Problem Statement

Without Code Mode, multi‑step tasks require many back‑and‑forth tool calls through the LLM, adding latency and cost, and increasing failure surface. We need a way for the agent to express the whole plan succinctly as code, run it once near the tools, and return a single consolidated result—without weakening isolation or governance.

---

## Goals (this epic)

1. Code Mode in Orchestrator: add a code‑execution endpoint that runs short, LLM‑generated functions with only the user’s allowed tools bound.
2. Typed Tooling: convert the user’s MCPJungle tools (Weather, Apple App Store, Amazon Music, etc.) into a TypeScript API the LLM can target reliably.
3. Secure Sandboxes: execute each run in a fresh, tightly constrained sandbox (no general network; only orchestrator bindings; time/memory/output caps).
4. Seamless Proxying: route tool calls through Orchestrator → user’s MCPJungle instance → underlying MCP servers, preserving streaming and cancellations.
5. Observability: logs, traces, and metrics for code generation, execution time, and tool call outcomes, correlated to the user and tools.

### Non‑Goals (this epic)

- Billing/quotas, fine‑grained policy engines, or a long‑running authoring IDE. Those are future epics.
- Replacing MCPJungle: it remains the per‑user app store/proxy and source of truth for tool catalogs.

---

## Target Architecture

```
Client (AI Agent)
   │  prompt (multi‑step intent)
   ▼
Orchestrator (MCP)
   ├─ Code Mode Layer
   │   ├─ Type Generator (MCP → TS signatures)
   │   ├─ Prompt contract (emit code only)
   │   └─ Sandbox Runtime (per‑execution isolate)
   └─ Proxy Router (request ID mapping, streaming)
        └─ User’s MCPJungle (app store / many MCPs)
             ├─ Weather MCP
             ├─ Apple App Store MCP
             └─ Amazon Music MCP
```

High‑level flow:
1) Discover: Orchestrator fetches the user’s tool list from their MCPJungle and generates TS signatures.  
2) Codegen: The LLM emits a single async function that uses those typed functions.  
3) Execute: Orchestrator runs it in a sandbox; each call is proxied to MCPJungle; progress/cancel respected.  
4) Return: On success, return `{ code, result }`; on failure, return concise diagnostics.

---

## Why this improves outcomes

- Fewer LLM round‑trips: one program executes an entire plan locally in the sandbox.  
- Lower cost: less token chatter between steps.  
- Higher reliability: typed API prevents many misuse errors; control flow lives in code, not prompts.  
- Stronger safety: per‑execution sandbox, least‑privileged bindings, no raw keys in code.

---

## Deliverables

1. New Orchestrator endpoint that accepts a request, constructs Code Mode context (typed tools + prompt contract), executes the generated code, and returns `{ code, result }`.
2. Tool type generation from MCPJungle schemas; canonical names (e.g., `server__tool`).
3. Proxy bridge: sandbox calls → orchestrator → user’s MCPJungle → target MCP tool.
4. Security enforcement: no ambient network in sandbox; time/memory/output caps; per‑user allowlists.
5. Observability: metrics (code‑gen time, eval time, tool call count/latency), logs, and traces across the full path.

---

## Milestones (MVP → GA)

1) Spike (MVP):
   - Bind 3–5 tools (e.g., Weather, Apple App Store, Amazon Music) into Code Mode.
   - Execute a sample multi‑step plan end‑to‑end with streaming and cancel support.

2) Harden:
   - Add caps (time, memory, output size) and deny ambient network; expose only orchestrator bindings.  
   - Correlated logs, OTEL traces; basic error diagnostics surfaced to the agent.

3) Productize:
   - Catalog hashing and type‑cache invalidation; stable canonical naming.  
   - Rollout flags and per‑tenant configuration; documentation and runbooks.

---

## Success Criteria

- End‑to‑end flows with ≥2 tool calls execute in a single run with lower latency and token usage vs. direct tool‑calling.
- Typed tool API generated for all tools visible to a user; canonical naming and routing verified.
- Sandbox isolation validated (no ambient network; limits enforced; secrets never exposed to code).
- Telemetry shows call volumes, latencies, and error rates across Orchestrator ↔ MCPJungle ↔ MCP servers.

---

## Risks & Mitigations

- Invalid code from LLM → Return concise diagnostics; allow one short self‑repair attempt; fall back to direct tool calls if needed.  
- Schema drift → Include catalog hash/ETag; regenerate typings when MCPJungle reports changes.  
- Performance regressions → Cache type generation; stream responses; keep the proxy path lean.  
- Scope creep (policy/billing) → Keep out of this epic; document as follow‑ups.

---

## Notes on Per‑User Design

- Per‑user MCPJungle remains the authoritative catalog and proxy.  
- Code Mode runs per‑execution in Orchestrator to preserve a clean separation of concerns (supervisor vs. store).  
- All bindings and allowlists are computed from the user’s MCPJungle visibility and Orchestrator policy.

---

## Next Steps

1. Wire Code Mode into Orchestrator with the per‑user MCPJungle binding.  
2. Generate and cache tool typings per `(user, catalogHash)`; expose canonical names.  
3. Add the sandbox runtime and proxy bridge; return `{ code, result }` with minimal diagnostics.  
4. Add telemetry, limits, and rollback flags.  
5. Document developer and ops flows; add a few live examples (e.g., “If raining, recommend an app and queue a playlist”).

---

## Reference

- Epic 1: Orchestrator as MCP Gateway over MCPJungle (pass‑through, governance, observability).  
- Epic 2: Code Mode layer (typed API, sandboxed execution).  
- Cloudflare’s Code Mode concept (background context): converts tools to a TS API and runs agent code in an isolate to cut round‑trips and hide secrets.

---

## Deployment Modes: Multi‑tenant vs Per‑User Jungle Instances

Default (recommended): Multi‑tenant MCPJungle
- One shared MCPJungle service; per‑user catalogs and permissions enforced via identity.  
- Orchestrator remains multi‑tenant and stateless; Code Mode runs as per‑execution ephemeral sandbox (no general network; only orchestrator bindings).  
- Benefits: simplest to operate, fastest to scale, lowest cost.  

Optional (for strict isolation/compliance): Per‑User Jungle Instances
- Orchestrator maintains a mapping `userId → jungleBaseUrl`.  
- On first access: provision a dedicated Jungle instance (Docker/K8s/VM), persist its endpoint and TTL, health‑check and reuse on subsequent requests.  
- Code Mode remains per‑execution ephemeral; containerization is only for Jungle isolation.  
- Use a feature flag/config (e.g., `ISOLATED_JUNGLE=enabled`) to enable this mode per tenant.

Operational Notes
- Keep the proxy/router logic abstracted so routing can target either shared Jungle or a per‑user instance without changing Code Mode or client contracts.  
- Add lifecycle controls: inactivity TTL, graceful teardown, and instance GC.  
- Observability must include instance provisioning time, health, and per‑instance usage.

---

## Order of Operations (Implementation Sequence)

1) Merge Code Mode into Orchestrator (multi‑tenant baseline)
   - Generate typed tool APIs from the user’s MCPJungle catalog.  
   - Add the per‑execution sandbox and proxy bridge (Orchestrator → Jungle → tools).  
   - Ship with shared Jungle as the default (current `JUNGLE_URL`), preserving existing behavior.

2) Introduce Routing Abstraction
   - Add a routing layer that resolves the upstream Jungle endpoint per request.  
   - Support two backends: (a) shared Jungle, (b) per‑user Jungle instance (look up mapping).

3) Add Per‑User Jungle Instance Provisioning (feature‑flagged)
   - Implement on‑demand provisioning (Docker/K8s), store `userId → jungleBaseUrl` with TTL and health checks.  
   - Wire the router to prefer per‑user instances when the feature flag/tenant setting is enabled.  
   - Ensure teardown/GC and robust error handling/fallback to shared mode if provisioning fails.

4) Harden and Observe
   - Enforce execution and network limits in Code Mode; instrument metrics for code‑gen/eval time and tool latencies.  
   - Emit provisioning metrics (success rate, cold‑start time) and per‑instance usage.  
   - Document operator runbooks for both modes and cut a rollout plan.

Rationale
- Building Code Mode first delivers immediate performance and reliability wins without changing your deployment model.  
- The routing abstraction decouples execution from isolation strategy.  
- Per‑user Jungle instances become an opt‑in capability for customers who need hard isolation, residency, or version pinning, without burdening the default path.


