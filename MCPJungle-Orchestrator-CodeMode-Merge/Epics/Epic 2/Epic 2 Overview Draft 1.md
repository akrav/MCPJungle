# Epic: CodeMode Layer for MCP Orchestrator (TypeScript API over MCP Tools)

> **One‑liner**: Add a **CodeMode‑style layer** to the MCP Orchestrator that **exposes MCP tools as TypeScript-callable functions**. The LLM writes short code that composes these functions; the orchestrator executes the code in a constrained runtime and proxies calls to the underlying MCP tools.

---

## Problem Statement

Traditional MCP usage exposes tool schemas directly to the LLM, leading to verbose tool-calling traces, token waste, and brittle multi-step plans. Cloudflare’s **Code Mode** approach flips this: **generate TypeScript calling code against a typed API** representing tools, then **execute** that code near the tools. This reduces token usage, improves composability, and keeps complex control flow out of the prompt.

---

## Design Inspirations (External)

* **Cloudflare Code Mode**: Convert tools into a **TypeScript API** and ask the LLM to **write code** that calls it; execute in a Worker sandbox. *(Core idea we adopt.)*
* **Agents SDK CodeMode utilities**: Programmatically **generate TS types** from tool schemas (Zod/JSON Schema) and provide a small runtime that **evaluates generated code** with a proxy back to the real tool implementations.

> We integrate these ideas inside the MCP Orchestrator so **any MCP tool** (from MCPJungle or local) is callable as a typed TS function.

---

## Goals & Non‑Goals

### Goals (this epic)

1. **Typed MCP API Generation**: Build a generator that maps MCP tool schemas → **TypeScript function signatures** (input/output types) and a **module** exporting `const codemode = { ... }` with one function per tool, namespaced (e.g., `server__list_files`).
2. **Code Execution Runtime**: Provide a **constrained JS/TS runtime** (Node/Deno/Workers-like) that can evaluate an async function emitted by the LLM and **proxy** each `codemode.<fn>(args)` call back to the orchestrator.
3. **Proxy Bridge**: Implement a bridge so `codemode` functions **invoke MCP tools** (via the Orchestrator → per-user MCPJungle instance).
4. **Prompt Contract**: Provide a **compact system prompt** instructing the LLM to

   * emit only code,
   * use the provided `codemode` functions,
   * perform multi-step orchestration within code, and
   * return a minimal `{ code, result }` object to the caller.
5. **Observability**: Log code evaluation attempts, tool invocations, timing, and errors with correlation IDs; surface structured outputs.
6. **Security**: Sandboxed execution, no ambient network except the orchestrator proxy; configurable allowlist for reachable tools.

### Non‑Goals (this epic)

* No billing/rate limiting (covered by separate epics).
* No persistent authoring IDE—LLM code is **ephemeral** per task, cached only for debugging if enabled.

---

## High‑Level Architecture

```
Client (AI Agent)
   │  prompt → wants multiple tools
   ▼
Orchestrator (MCP Server)
   ├─ CodeMode Layer
   │   ├─ Type Generator (MCP → TS signatures)
   │   ├─ Prompt Builder (compact “emit code only”)
   │   └─ Code Runtime (sandbox + proxy bindings)
   └─ Proxy Router
       └─ Per‑User MCPJungle instance → actual MCP servers/tools
```

**Flow**

1. **Discover** tools (from per-user MCPJungle + local) and **hydrate TS signatures**.
2. LLM receives **short prompt** + TS ambient `declare const codemode: {...}` and emits **one async function**.
3. Orchestrator executes code in sandbox. Calls to `codemode.<fn>(args)` cross the **proxy bridge** back to the orchestrator.
4. Orchestrator resolves `server__tool` and forwards over MCP to the user’s MCPJungle instance; streams results back to the sandbox → returns `{ code, result }` to the agent.

---

## Key Components

1. **Type Generator**

   * Input: MCP `tool` objects (JSON Schema) and/or Zod specs.
   * Output: A **d.ts** (or string) with `interface <ToolName>Input/Output` and a `declare const codemode: { <name>(input): Promise<Output> }` aggregate.
   * Namespacing: Use `server__tool` canonical names to avoid collisions.
   * Versioning: Include `ETag`/hash so code can be cached per tool-set revision.

2. **Prompt Builder**

   * Concise **system prompt** explaining the available `codemode` functions.
   * Instruction to **output only code** (an `async function` with no args) and handle all branching/loops/retries inside code.

3. **Code Runtime**

   * **Sandbox**: No filesystem; no unrestricted `eval/Function` except our controlled evaluator; no ambient fetch except the provided `codemode` proxy binding; timeouts.
   * **Evaluator**: Load a transient in-memory module that injects a `codemode` **Proxy** whose methods marshal `{ functionName, args }` back to the orchestrator.
   * **Result Shape**: `{ code: string, result: any }` with optional diagnostics.

4. **Proxy Bridge**

   * JSON-RPC-like call `{ fn, args }` → Orchestrator resolves → MCP `call_tool`.
   * Handle **progress/cancel** and **request ID mapping** through the existing orchestrator pipeline.

5. **Observability & Governance**

   * Structured logs: emitted code hash, tool call counts, latencies, failures.
   * Toggle to persist code for debugging (redact secrets) or discard by default.

---

## Contracts & Data Shapes

* **`codemode` API (ambient)**

  ```ts
  // Generated per catalog revision
  declare const codemode: {
    /** <tool description> */
    "server__toolA": (input: ServerToolAInput) => Promise<ServerToolAOutput>;
    "server__toolB": (input: ServerToolBInput) => Promise<ServerToolBOutput>;
    // ...
  }
  ```

* **Resources (read‑only)**

  ```ts
  // Expose discoverable resources as typed getters
  declare const resources: {
    "server__resourceId": () => Promise<ServerResourceType>;
    // ... all read‑only
  }
  ```

* **Execution Return**

  ```ts
  interface CodeModeReturn { code: string; result: unknown }
  ```

## Security Model

* **Isolated runtime** per request; deny network by default; only the orchestrator’s **proxy binding** is reachable.
* **No Globals/Helpers**: Remove or stub out `fetch`, timers, filesystem, `crypto.subtle`, and other ambient capabilities. Provide only `codemode`.
* **Allowlist** of tools (per user/tenant) enforced in the orchestrator, before forwarding.
* **Resource guards**: execution time limit, memory cap, output size cap.
* **Code storage**: off by default; when enabled, encrypt at rest; attach correlation IDs.

## Observability

* **Metrics**: code-gen time, eval time, tool-call count, success/error rates.
* **Tracing**: spans across Agent → Orchestrator/CodeMode → per-user MCPJungle → tool server.
* **Logs**: code hash, selected tools, schema version IDs, errors with redacted inputs.

---

## Example Developer Workflow (Happy Path)

1. Agent requests: “Summarize repo issues and open a PR.”
2. Orchestrator builds TS typings for tools like `git__list_issues`, `git__create_branch`, `git__open_pr`.
3. LLM emits a function that: fetches issues → filters → creates a branch → commits → opens PR—by calling `codemode.<fn>`.
4. Sandbox executes; each call is proxied to MCP tools; final `{ code, result }` is returned.

---

## Risks & Mitigations

* **Unbounded Code**: Infinite loops or runaway fetches → hard timeouts, no ambient network, instruction to keep code short.
* **Schema Drift**: Tool schema changes break generated types → include schema hash; invalidate and re-gen types.
* **Opaque Failures**: LLM produces invalid code → strict TS/JS transpile step with readable compile errors surfaced to the model (chain-of-repair prompt) or fallback to direct tool calls.

---

## MVP Scope & Acceptance Criteria

* ✅ Generate TypeScript typings for **at least 10 tools** from the user’s MCPJungle instance + one local tool.
* ✅ Provide a working **sandbox** that evaluates one async function, with a `codemode` Proxy bridge to the orchestrator.
* ✅ Execute multi-step flows calling **2+ tools** in a single run.
* ✅ Basic logging/metrics and correlation IDs.
* ✅ Security controls (no ambient network, time/memory caps).

---

## Implementation Notes

* **Typing Pipeline**: Prefer JSON Schema → TS using `json-schema-to-typescript`; support Zod where present (Zod → TS via `zod-to-ts`).
* **Evaluator**: Use a lightweight module loader; in Node/Deno, compile TS → JS with isolated `vm`/`worker_threads`/Deno sandbox; in Workers, use a Worker Entrypoint pattern.
* **Prompt Template**: Small and opinionated—“emit only code, use `codemode`, single async function, no args.”
* **Caching**: Cache generated typings per `(user, catalogHash)`; code-run cache keyed by code hash for idempotent retries.
* **Namespacing**: Expose functions using canonical `server__tool` names (mirrors orchestrator routing).

---

## Open Questions (Resolved)

1. **Streaming?** No — **atomic responses only**; return `{ code, result }` once the sandbox finishes.
2. **Helpers/globals?** No — **disallow helpers and globals** (including `fetch`, timers, filesystem, network). Only provide the `codemode` proxy binding.
3. **Compile-error feedback loop?** See **Best Practices for Error Feedback** below.
4. **Expose resources as typed getters?** Yes — expose **read-only** resources as typed getters alongside tools.

## Best Practices for Error Feedback

* **Deterministic Build Step**: transpile TS→JS with strict settings (`noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); fail fast on type errors.
* **Minimal Diagnostic Surface**: surface only `{ message, line, column, codeHash }` to the LLM; omit stack traces and environment details.
* **Single Self‑Repair Attempt**: allow **one** automatic retry where the LLM receives the minimal diagnostics and the exact type signatures; if it fails again, abort and return a structured error.
* **Schema‑Driven Messages**: when a tool input fails validation (Zod/JSON Schema), convert to **concise field‑level diagnostics** (e.g., `"search.query" is required (string)`).
* **Guard Against Non‑Determinism**: disallow global state, time, and random sources unless provided as explicit parameters via `codemode`.
* **Safety Budget**: cap code size, eval time, memory, and max tool calls; return a specific `LimitExceeded` diagnostic if hit.

## Rollout Plan

1. **Phase 0**: Spike—generate typings for a small subset, run end-to-end with a couple of tools.
2. **Phase 1**: Generalize generation across the full catalog; land sandbox with caps; bridge in place.
3. **Phase 2**: Observability polish, error-correction prompt, and optional code caching.

---

## Appendix: Mapping to External References

* **“Convert MCP tools into a TypeScript API and have the LLM write code that calls it”** → Code Mode pattern.
* **“Generate types from schemas; return only code; evaluate with a proxy back to bound functions”** → Agents SDK CodeMode utilities.
