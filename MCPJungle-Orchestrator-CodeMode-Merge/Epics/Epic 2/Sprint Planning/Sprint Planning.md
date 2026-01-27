Here’s a dependency-aware sprint plan for **Epic 2: CodeMode Layer for MCP Orchestrator**. Each sprint builds on the last and assumes Epic 1’s orchestrator (Streamable HTTP `/mcp`, per-user MCPJungle instances, routing, ID remap) is in place.

---

# Sprint 0 — CodeMode spike & contracts

**Objective**
Prove the CodeMode pattern end-to-end on a tiny subset of tools and lock the core contracts: generated TS types, “emit-code-only” prompt, sandbox evaluation with a `codemode` proxy.

**Why first**
This validates the basic approach (convert tools → TS API; model emits code; sandbox executes; proxy invokes tools) before you invest in productionizing. The pattern follows Cloudflare’s Code Mode design. ([The Cloudflare Blog][1])

**Key tasks**

* Hard-code 2–3 tools from a dev MCPJungle instance; hand-write minimal TS types and a tiny `declare const codemode: {...}`.
* Build a minimal “emit only code” prompt and run a single async function end-to-end.
* Implement a throwaway sandbox runner that only exposes `codemode` and returns `{ code, result }`.

**Exit criteria**

* Model emits a single async function; sandbox runs; proxy invokes at least **2 tools**; you get `{ code, result }`. (Atomic, no streaming.)

---

# Sprint 1 — Type Generator (MCP → TypeScript)

**Objective**
Generate **TypeScript** function signatures and input/output interfaces directly from MCP tool schemas (JSON Schema and/or Zod) and emit a stable `declare const codemode` surface.

**Why now**
Type safety is the backbone of CodeMode—LLM composes functions correctly and you get precise compile/validation errors. Cloudflare’s agents utilities demonstrate JSON-Schema↔TS / Zod↔TS flows. ([Cloudflare Docs][2])

**Key tasks**

* JSON Schema → TS via `json-schema-to-typescript`; Zod → TS via `zod-to-ts` (where available). (Match names to `server__tool` canon.)
* Emit `interface <ToolName>Input/Output` and an ambient `declare const codemode: { "<server__tool>": (input) => Promise<Output> }`.
* Hash/ETag the schema bundle and embed it to version the generated typings.

**Exit criteria**

* For a user’s catalog, generator emits a complete `.d.ts` (or string) with ≥10 tools and stable names; types change when schemas change. ([Cloudflare Docs][2])

---

# Sprint 2 — Prompt Builder & compile gate

**Objective**
Ship the compact **prompt contract** (“emit only code, single async function, use `codemode`”) plus a strict **TS→JS compile gate** that returns minimal diagnostics on failure.

**Why now**
Keeps token use low and forces control-flow into code (Code Mode principle). The compile gate powers the safe, one-retry “self-repair” loop. ([The Cloudflare Blog][1])

**Key tasks**

* Prompt template that enumerates available functions by description (not the whole type file), reminds: “output only code; no commentary.”
* Compiler step with strict flags (`noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and concise diagnostics `{message,line,column,codeHash}`.
* One self-repair attempt; then abort with structured error.

**Exit criteria**

* Bad code gets minimal diagnostics and one retry; good code compiles and proceeds.

---

# Sprint 3 — Locked-down sandbox (no globals/helpers)

**Objective**
Implement a hardened **evaluation runtime** that exposes **only** the `codemode` proxy (and later `resources` getters). No `fetch`, timers, fs, env, crypto, etc.

**Why now**
Security and determinism are non-negotiable. Node’s `vm` is **not** a security mechanism; prefer a runtime that defaults to zero permissions (e.g., Deno/Workers). ([Node.js][3])

**Key tasks**

* Choose runtime:

  * **Workers/Durable Objects** style evaluator (fits CF pattern), or
  * **Deno** with **no permissions** (no `--allow-*`) to ensure no ambient I/O. ([Deno][4])
* Inject a `Proxy` for `codemode` that marshals `{ functionName, args }` back to orchestrator.
* Enforce caps: max code size, eval time, memory, and max tool calls.

**Exit criteria**

* Sandbox runs without any ambient APIs; attempts to access globals fail; caps enforced with `LimitExceeded` errors.

---

# Sprint 4 — Proxy bridge to orchestrator → per-user MCPJungle

**Objective**
Wire the sandbox `codemode.<fn>(args)` calls through the **orchestrator** to the **user’s** MCPJungle instance, reusing Epic 1 routing + request-ID remap.

**Why now**
This is the production path that turns typed function calls into MCP tool invocations. (You already have routing/ID remap from Epic 1.)

**Key tasks**

* JSON-RPC-like payload `{ fn, args }` → resolve `<server__tool>` → forward over MCP via the user’s instance; translate progress/cancel/errors.
* Validate inputs against generated schemas; on failure, return field-level diagnostics (concise).
* Preserve correlation IDs in spans/logs.

**Exit criteria**

* A multi-step CodeMode program calling ≥2 tools executes cleanly via the user’s MCPJungle instance with full traceability.

---

# Sprint 5 — Read-only `resources` getters

**Objective**
Expose **read-only resources** as typed getters adjacent to tools (e.g., `resources["server__resourceId"](): Promise<T>`), routed through the orchestrator.

**Why now**
Many MCP servers publish “resources” that are useful to hydrate code without additional token chatter; doing this read-only maintains safety and consistency. (Aligns with Code Mode’s typed surface idea.) ([The Cloudflare Blog][1])

**Key tasks**

* Extend generator to produce `declare const resources: {...}` from MCP capabilities.
* Bridge getter invocations over MCP; cache small immutable payloads (ETag/TTL) at the orchestrator.
* Ensure getters remain read-only and respect allowlists.

**Exit criteria**

* LLM code successfully uses at least one typed resource getter alongside tools.

---

# Sprint 6 — Observability for CodeMode runs

**Objective**
Instrument CodeMode: code hash, schema hash, compile time, eval time, tool-call count, latencies, errors; add spans that align with orchestrator and MCPJungle hops.

**Why now**
You need visibility to tune types, prompt size, and performance. Cloudflare Agents docs emphasize SDK surfaces and configuration; pair with OpenTelemetry for traces/metrics. ([Cloudflare Docs][2])

**Key tasks**

* Emit spans for **compile → evaluate → each tool call** (with correlation IDs).
* Counters/histograms for “tool calls per run”, p50/p95 eval time, failure categories.
* Optional code persistence (off by default); if enabled, encrypt + attach code hash only.

**Exit criteria**

* Dashboards show end-to-end traces and key KPIs; top errors are identifiable.

---

# Sprint 7 — DX polish & caching

**Objective**
Improve developer and model ergonomics while reducing cost: stable cache keys for typings & results; ergonomic errors; small example gallery.

**Why now**
With the core working, make it pleasant and efficient to use—consistent with Cloudflare’s “emit code only” workflow and starter templates. ([GitHub][5])

**Key tasks**

* Cache typings by `(userId, catalogHash)`; cache CodeMode results by `codeHash` (idempotent replays).
* Add tiny examples (e.g., `git__list_issues → git__open_pr`) to regression-test common flows.
* Dev tooling: CLI to print currently generated types; quick repro harness for compile errors.

**Exit criteria**

* Cold vs warm runs show measurable gains from caches; examples pass CI.

---

# Sprint 8 — Hardening & MVP acceptance

**Objective**
Lock MVP for the epic with soak tests, chaos drills, and documentation.

**Why now**
Proves the system under real usage patterns and failure modes before widening adoption.

**Key tasks**

* Soak: many short CodeMode runs composing 2–4 tools; measure token reduction vs direct tool-calling flows (qualitative OK).
* Chaos: kill the user’s MCPJungle instance mid-run; confirm errors are crisp and no leakage from sandbox.
* Docs: “Using CodeMode,” “Security model,” “Error feedback loop,” “Resources getters.”

**Exit criteria (mirrors Epic 2 MVP)**

* Types generated for ≥10 tools + 1 local tool.
* Sandbox evaluates one async function with `codemode` and (optionally) `resources`.
* Multi-step flows (≥2 tools) execute successfully.
* Metrics/traces/logs present; security caps enforced; atomic `{code, result}` responses. ([The Cloudflare Blog][1])

---

### Notes & references

* **Code Mode concept** (convert tools → TS API; model emits code; run in sandbox) and the “emit code only” prompt: Cloudflare blog & Agents docs. ([The Cloudflare Blog][1])
* **Security posture** (no `vm` for untrusted code; prefer zero-perm runtime like Deno/Workers): Node docs & Deno security model. ([Node.js][3])
* **Agents SDK** surfaces & config for productionizing on Cloudflare: Agents docs & API reference. ([Cloudflare Docs][2])

If you want, I can convert these into **Jira-ready tickets** with DoD/test notes for each sprint, or add a **minimal repo layout** showing the generator, sandbox, and proxy folders to kick off Sprint 0/1.

[1]: https://blog.cloudflare.com/code-mode/?utm_source=chatgpt.com "Code Mode: the better way to use MCP"
[2]: https://developers.cloudflare.com/agents/?utm_source=chatgpt.com "Cloudflare Agents docs"
[3]: https://nodejs.org/api/vm.html?utm_source=chatgpt.com "VM (executing JavaScript) | Node.js v24.9.0 Documentation"
[4]: https://docs.deno.com/runtime/fundamentals/security/?utm_source=chatgpt.com "Security and permissions"
[5]: https://github.com/cloudflare/agents-starter?utm_source=chatgpt.com "A starter kit for building ai agents on Cloudflare"
