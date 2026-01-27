# Sprint 1 — Typed Tool Surface + Prompt Contract (reuse codemode-standalone)

**Goal**  
Expose the user’s MCPJungle catalog as a stable, typed `codemode` API and ship the minimal “emit code only” prompt for Code Mode runs in the orchestrator. Reuse `codemode-standalone` components; do not rebuild them.

**Rule of engagement**  
Do tickets in order. For each ticket: implement → write tests → run tests → fix until green → commit & push to branch `Orchestrator-CodeMode-Merge`. If any test fails, loop/fix and re-run until green before pushing.

**What we will reuse (preexisting)**

* From `codemode-standalone`:
  * `TypeGenerator` (schema → TS declarations)
  * `MCPClient` + `MCPToolConverter` (fetch tools from Jungle when needed)
  * `IsolatedExecutor` and `SecurityPolicy` (used next sprint; referenced for typings context only)
* From `orchestrator`:
  * Config loader (`loadConfig`) to read `JUNGLE_URL`, token, timeouts
  * Existing JSON-RPC validation/helpers for consistent request handling

**Repo layout (S1 additions highlighted)**

```
/orchestrator
  /src
    /codemode                                   # NEW in S1
      typegen.ts                                # wraps codemode-standalone TypeGenerator
      prompt.ts                                 # prompt builder (emit-code-only contract)
      cache.ts                                  # in-memory cache, keyed by (userId,catalogHash)
      index.ts                                  # surface: getTypedSurface(userId) → { dts, hash }
    /config/{schema,load}.ts                    # reused
    /jsonrpc/{types,validate,errors}.ts         # reused
    /server/http.ts                             # no change in S1
  /tests/sprint1-codemode                       # NEW in S1
    typegen_namespacing.spec.ts
    typegen_hashing.spec.ts
    prompt_contract.spec.ts
    mcp_client_listtools_smoke.spec.ts          # guarded: skips if no Jungle (uses mock or docker profile)
```

---

## Ticket-3101 — Codemode folder scaffold

**What / Why**  
Create `src/codemode/` structure and barrels so later tickets have clean seams. No runtime logic yet.

**Where**  
`/orchestrator/src/codemode/{index.ts,typegen.ts,prompt.ts,cache.ts}`

**Implementation sketch**

* `index.ts`: export `getTypedSurface({ userId }): Promise<{ dts: string; hash: string }>` (stubbed returns for now).
* Empty modules with TODO signatures only; add JSDoc on responsibilities.

**Tests**  
`prompt_contract.spec.ts`: placeholder test ensures module loads and exposes expected function names.

**Accept when**  
Modules compile; exports exist; tests pass.

**LLM priming**  
`barrel export`, `index.ts`, `JSDoc module contracts`

---

## Ticket-3102 — Type generation wiring (reuse TypeGenerator)

**What / Why**  
Use `codemode-standalone`’s `TypeGenerator` to convert MCPJungle tool schemas to a `declare const codemode: { "server__tool": (input) => Promise<Output> }` declaration string, with canonical names.

**Where**  
`/orchestrator/src/codemode/typegen.ts`

**Implementation sketch**

* Accept tool descriptors fetched via Jungle (shape from MCP `tools/list`).
* Map names to canonical `server__tool` (double underscore) if not already canonical.
* Call `TypeGenerator.generateTypeDefinitions(tools)` and return `{ dts, names: string[] }`.

**Tests**  
`typegen_namespacing.spec.ts`: given tools `[ { server:"weather", name:"forecast" } ]` → output has `"weather__forecast"` signature; no duplicates; valid TS-looking surface.

**Accept when**  
Output contains canonical names and a single ambient `declare const codemode` block.

**LLM priming**  
`TypeGenerator`, `server__tool`, `ambient declaration`, `JSON Schema → TS`

---

## Ticket-3103 — Catalog hash & cache (in-memory)

**What / Why**  
Avoid regen churn: compute a stable `catalogHash` from tool schemas and cache generated typings per `(userId,catalogHash)`.

**Where**  
`/orchestrator/src/codemode/cache.ts`, used by `index.ts`

**Implementation sketch**

* Hash function: stable JSON stringify of `[ {name, schemaETagOrJSON} ]` → `sha256` → hex.
* Cache map: `Map<string /*userId:hash*/, { dts, hash, ts: number }>` with simple TTL (e.g., 10m) configurable.

**Tests**  
`typegen_hashing.spec.ts`: same input → same hash; order-insensitive; schema change → new hash; cache hit returns same `dts` without regen.

**Accept when**  
Hash stable; cache prevents redundant generator calls (assert call count).

**LLM priming**  
`sha256`, `stable stringify`, `TTL cache`, `Map get-or-set`

---

## Ticket-3104 — Prompt builder (emit-code-only contract)

**What / Why**  
Provide a compact prompt string that lists available function names + short descriptions and instructs the model to output only a single async function using `codemode`.

**Where**  
`/orchestrator/src/codemode/prompt.ts`

**Implementation sketch**

* Inputs: `{ functions: Array<{ name: string; description: string }> }`.
* Output: string containing: brief context, guardrails (no commentary), and usage example line showing `await codemode["server__tool"](args)`.

**Tests**  
`prompt_contract.spec.ts`: includes all function names; contains “output only code”, “single async function”, and no accidental secrets.

**Accept when**  
Prompt contains names and required guardrails; length under a small threshold (configurable).

**LLM priming**  
`emit code only`, `single async function`, `codemode["name"](input)`

---

## Ticket-3105 — Jungle tool fetch (smoke; reuse MCPClient)

**What / Why**  
Fetch tools for the current user from Jungle using `MCPClient` (SSE) to feed the generator. Keep this as a smoke test in CI (mock or docker profile).

**Where**  
`/orchestrator/src/codemode/index.ts` (integration) and `/tests/sprint1-codemode/mcp_client_listtools_smoke.spec.ts`

**Implementation sketch**

* Use `loadConfig` to get `JUNGLE_URL`, pass to `MCPClient({ url, transport:"sse" })`, then `.connect()` + `.getTools()`.
* In tests, prefer a mock/mocked client; enable a docker profile job to hit a real Jungle in CI if desired.

**Tests**  
`mcp_client_listtools_smoke.spec.ts`: guarded by env; asserts tools array length ≥ 0 without throwing; logs a couple names.

**Accept when**  
Smoke passes in local/dev; test suite is green using mock by default.

**LLM priming**  
`SSEClientTransport`, `@modelcontextprotocol/sdk`, `connect()`, `listTools()`

---

## Ticket-3106 — Wire typed surface facade

**What / Why**  
Add the public function that ties it together: `getTypedSurface({ userId })` → fetch tools (via Jungle), generate typings, cache by `(userId,catalogHash)`, and return `{ dts, hash }`.

**Where**  
`/orchestrator/src/codemode/index.ts`

**Implementation sketch**

* Compose: load config → fetch tools → `TypeGenerator` → `cache.getOrCreate(userId,hash)`.
* No HTTP endpoint yet (that lands next sprint with execution); pure function for now.

**Tests**  
Extend `typegen_hashing.spec.ts` to verify cache actually engaged via `index.ts` and returns stable `{ dts, hash }`.

**Accept when**  
Single call returns `{ dts, hash }`; repeated call with same catalog uses cache; schema mutation changes hash.

**LLM priming**  
`facade`, `compose helpers`, `unit-testable pure function`

---

## How to run Sprint 1 tests locally

```bash
# Install deps
npm i

# Run only Sprint 1 (codemode) tests
npm run test -- tests/sprint1-codemode

# (Optional) Start Jungle locally for smoke tests (docker profile)
docker compose --profile jungle up -d
export JUNGLE_URL=http://localhost:9000

# After tests pass, push to the feature branch
git checkout -B Orchestrator-CodeMode-Merge
git add -A && git commit -m "Epic3 S1: typed tool surface + prompt"
git push -u origin Orchestrator-CodeMode-Merge
```

---

### Notes

* This sprint intentionally avoids creating a new HTTP endpoint; it focuses on producing the typed surface and the prompt contract for Code Mode. The execution runtime hookup lands next sprint.
* Reuse is mandatory: `TypeGenerator`, `MCPClient`, `MCPToolConverter`, and (next sprint) `IsolatedExecutor` from `codemode-standalone`.
* Keep tests fast; guard docker/Jungle-dependent smoke tests behind an env flag/profile.

### References

* Code Mode idea and benefits (fewer round-trips, sandboxed execution): [Cloudflare Code Mode](https://blog.cloudflare.com/code-mode/)
* MCP tools discovery and call semantics: [Model Context Protocol — Tools](https://modelcontextprotocol.io/specification/2025-03-26/server/tools)


