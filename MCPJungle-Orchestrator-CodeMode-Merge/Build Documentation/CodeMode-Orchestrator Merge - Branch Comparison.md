### CodeMode ↔ Orchestrator merge: Orchestrator-CodeMode-Merge vs. Jonah-Merge-Code

Scope: compare how each branch integrates CodeMode with the Orchestrator (ignoring per‑user containerization). Focus on API shape, runtime model, safety, observability, coupling, and repo hygiene.

### High‑level approaches
- **Orchestrator-CodeMode-Merge (current)**
  - Integrates Code Mode as an internal runtime with a typed tool surface and a proxy bridge to Jungle.
  - Key modules: `src/codemode/{index,typegen,cache,prompt,binding,policy,runner,invoker,telemetry,trace}.ts`.
  - Uses a Proxy (`binding`) to route `codemode["server__tool"](args)` calls via `invoker` to Jungle JSON‑RPC.
  - Generates and caches ambient TS typings for tools (stable catalog hashing) for LLM prompt/IDE.
  - Optional dynamic import of `codemode-standalone` executor; otherwise a stub executor for tests.
  - Strong observability: OpenTelemetry spans/metrics, structured logs, verbose trace, code persistence (dev).
  - HTTP relay remains a pass‑through; Code Mode is not exposed as MCP tools.

- **Jonah-Merge-Code (alt)**
  - Exposes Code Mode itself as MCP tools surfaced by Orchestrator: `codemode__executeCode`, `codemode__executeCodeWithTools`, `codemode__listAvailableTools`.
  - Merges these into `tools/list` and intercepts `tools/call codemode__*` inside `src/server/http.ts`.
  - Builds a `tools` object (`toolset.ts`) from upstream Jungle and passes it into `codemode-standalone` engines.
  - Directly imports `codemode-standalone/dist` and executes there; no separate binding/invoker layer.
  - Simpler logs/metrics; relies on HTTP server for session/retry and a narrow security policy.

### Similarities
- **Session management**: both init/reflect `Mcp-Session-Id`, retry on transient upstream errors.
- **Upstream bridge**: both call Jungle over JSON‑RPC (`tools/list`, `tools/call`, `cancel`).
- **Env‑driven policy**: both read execution/time/memory flags from env.
- **Basic observability**: structured logs and minimal metrics in both.

### Key differences
- **API surface to clients**
  - Orchestrator-CodeMode-Merge: Code Mode is an internal capability; not advertised as MCP tools.
  - Jonah-Merge-Code: Code Mode is exposed as first‑class MCP tools and included in `tools/list`.

- **Runtime model**
  - Orchestrator-CodeMode-Merge: sandbox executes LLM code that calls a typed `codemode` proxy; bridge centralizes cancel/stream/error mapping and enforces per‑run limits (time/memory/tool‑calls).
  - Jonah-Merge-Code: engine receives a prebuilt `tools` object and executes inline; fewer enforcement/bridge layers.

- **Type system & DX**
  - Orchestrator-CodeMode-Merge: generates ambient typings (`declare const codemode`) per tool catalog (stable hash + cache).
  - Jonah-Merge-Code: offers `listAvailableTools` with examples; no ambient typings or catalog hashing.

- **Coupling to codemode-standalone**
  - Orchestrator-CodeMode-Merge: dynamic import with test stubs; avoids hard build coupling; Node 20 LTS; monorepo workspace.
  - Jonah-Merge-Code: direct import from `codemode-standalone/dist`; tighter build/runtime coupling; branch commits `node_modules`.

- **Observability depth**
  - Orchestrator-CodeMode-Merge: OTEL spans (compile/eval/tool‑call), counters, histograms, verbose trace files, code persistence.
  - Jonah-Merge-Code: lighter weight logs/metrics concentrated in HTTP relay and the service layer.

- **Separation of concerns**
  - Orchestrator-CodeMode-Merge: HTTP relay stays generic; Code Mode is isolated under `src/codemode/*` with a thin `invoker` using the same upstream client as HTTP.
  - Jonah-Merge-Code: HTTP server owns Code Mode concerns (merging into `tools/list`, intercepting `tools/call`).

### Robustness for production
- **Safety & limits**: Orchestrator-CodeMode-Merge enforces per‑run caps (time/memory/tool‑calls), denies ambient APIs, and includes cancel/stream handling and error mapping in a dedicated bridge. Advantage: fewer foot‑guns, clearer blast‑radius control.
- **Build/runtime coupling**: Orchestrator-CodeMode-Merge uses dynamic import and stubs → easier CI across platforms. Jonah-Merge-Code’s direct import of `dist` and committed `node_modules` increase fragility and repo bloat.
- **Observability**: Orchestrator-CodeMode-Merge’s OTEL + structured verbose traces are more actionable for SRE.
- Verdict: **Orchestrator-CodeMode-Merge is more robust for production**.

### Simplicity
- Jonah-Merge-Code is simpler to reason about and adopt quickly: “codemode as tools,” minimal files, one entry in the HTTP layer.
- Orchestrator-CodeMode-Merge is more modular and layered; steeper learning curve but clearer boundaries.
- Verdict: **Jonah-Merge-Code is simpler** for a quick proof/POC; Orchestrator-CodeMode-Merge is architecturally cleaner.

### Coding practice & repo hygiene
- Orchestrator-CodeMode-Merge: typed surfaces, clear modules, minimal cross‑cutting in HTTP, Node 20 via `.nvmrc` and `engines`, avoids committing `node_modules`.
- Jonah-Merge-Code: commits `orchestrator/node_modules`, couples to `dist` paths, folds product concerns into HTTP. This hurts maintainability.
- Verdict: **Orchestrator-CodeMode-Merge follows better practices**.

### Project structure
- Orchestrator-CodeMode-Merge: monorepo workspace; `src/codemode` encapsulates policy, runner, bridge, telemetry; server uses shared upstream client.
- Jonah-Merge-Code: `src/codemode/{service,toolset,schemas,upstream}` with server‑integrated merge/intercept logic.
- Verdict: **Orchestrator-CodeMode-Merge offers a more scalable layout** for growth (typegen, caching, isolates, telemetry).

### Recommendation
- For production: adopt **Orchestrator-CodeMode-Merge** as the base. It’s more defensive, observable, and decoupled, with clean typing and routing. If you want the “codemode as tools” developer convenience, consider adding a small adapter that exposes a thin `codemode__executeCode` endpoint on top of the existing runner/bridge without moving the logic into the HTTP server.

### Notes
- This comparison intentionally ignores per‑user containerization and routing. The conclusions above hold for shared Jungle as well.

### CodeMode ↔ Orchestrator merge: Orchestrator-CodeMode-Merge vs. Jonah-Merge-Code

Scope: compare how each branch integrates CodeMode with the Orchestrator (ignoring per‑user containerization). Focus on API shape, runtime model, safety, observability, coupling, and repo hygiene.

### High‑level approaches
- **Orchestrator-CodeMode-Merge (current)**
  - Integrates Code Mode as an internal runtime with a typed tool surface and a proxy bridge to Jungle.
  - Key modules: .
  - Uses a Proxy () to route  calls via  to Jungle JSON‑RPC.
  - Generates and caches ambient TS typings for tools (stable catalog hashing) for LLM prompt/IDE.
  - Optional dynamic import of  executor; otherwise a stub executor for tests.
  - Strong observability: OpenTelemetry spans/metrics, structured logs, verbose trace, code persistence (dev).
  - HTTP relay remains a pass‑through; Code Mode is not exposed as MCP tools.

- **Jonah-Merge-Code (alt)**
  - Exposes Code Mode itself as MCP tools surfaced by Orchestrator: , , .
  - Merges these into  and intercepts  inside .
  - Builds a  object () from upstream Jungle and passes it into  engines.
  - Directly imports  and executes there; no separate binding/invoker layer.
  - Simpler logs/metrics; relies on HTTP server for session/retry and a narrow security policy.

### Similarities
- **Session management**: both init/reflect , retry on transient upstream errors.
- **Upstream bridge**: both call Jungle over JSON‑RPC (, , ).
- **Env‑driven policy**: both read execution/time/memory flags from env.
- **Basic observability**: structured logs and minimal metrics in both.

### Key differences
- **API surface to clients**
  - Orchestrator-CodeMode-Merge: Code Mode is an internal capability; not advertised as MCP tools.
  - Jonah-Merge-Code: Code Mode is exposed as first‑class MCP tools and included in .

- **Runtime model**
  - Orchestrator-CodeMode-Merge: sandbox executes LLM code that calls a typed  proxy; bridge centralizes cancel/stream/error mapping and enforces per‑run limits (time/memory/tool‑calls).
  - Jonah-Merge-Code: engine receives a prebuilt  object and executes inline; fewer enforcement/bridge layers.

- **Type system & DX**
  - Orchestrator-CodeMode-Merge: generates ambient typings () per tool catalog (stable hash + cache).
  - Jonah-Merge-Code: offers  with examples; no ambient typings or catalog hashing.

- **Coupling to codemode-standalone**
  - Orchestrator-CodeMode-Merge: dynamic import with test stubs; avoids hard build coupling; Node 20 LTS; monorepo workspace.
  - Jonah-Merge-Code: direct import from ; tighter build/runtime coupling; branch commits .

- **Observability depth**
  - Orchestrator-CodeMode-Merge: OTEL spans (compile/eval/tool‑call), counters, histograms, verbose trace files, code persistence.
  - Jonah-Merge-Code: lighter weight logs/metrics concentrated in HTTP relay and the service layer.

- **Separation of concerns**
  - Orchestrator-CodeMode-Merge: HTTP relay stays generic; Code Mode is isolated under  with a thin  using the same upstream client as HTTP.
  - Jonah-Merge-Code: HTTP server owns Code Mode concerns (merging into , intercepting ).

### Robustness for production
- **Safety & limits**: Orchestrator-CodeMode-Merge enforces per‑run caps (time/memory/tool‑calls), denies ambient APIs, and includes cancel/stream handling and error mapping in a dedicated bridge. Advantage: fewer foot‑guns, clearer blast‑radius control.
- **Build/runtime coupling**: Orchestrator-CodeMode-Merge uses dynamic import and stubs → easier CI across platforms. Jonah-Merge-Code’s direct import of  and committed  increase fragility and repo bloat.
- **Observability**: Orchestrator-CodeMode-Merge’s OTEL + structured verbose traces are more actionable for SRE.
- Verdict: **Orchestrator-CodeMode-Merge is more robust for production**.

### Simplicity
- Jonah-Merge-Code is simpler to reason about and adopt quickly: “codemode as tools,” minimal files, one entry in the HTTP layer.
- Orchestrator-CodeMode-Merge is more modular and layered; steeper learning curve but clearer boundaries.
- Verdict: **Jonah-Merge-Code is simpler** for a quick proof/POC; Orchestrator-CodeMode-Merge is architecturally cleaner.

### Coding practice & repo hygiene
- Orchestrator-CodeMode-Merge: typed surfaces, clear modules, minimal cross‑cutting in HTTP, Node 20 via  and , avoids committing .
- Jonah-Merge-Code: commits , couples to  paths, folds product concerns into HTTP. This hurts maintainability.
- Verdict: **Orchestrator-CodeMode-Merge follows better practices**.

### Project structure
- Orchestrator-CodeMode-Merge: monorepo workspace;  encapsulates policy, runner, bridge, telemetry; server uses shared upstream client.
- Jonah-Merge-Code:  with server‑integrated merge/intercept logic.
- Verdict: **Orchestrator-CodeMode-Merge offers a more scalable layout** for growth (typegen, caching, isolates, telemetry).

### Recommendation
- For production: adopt **Orchestrator-CodeMode-Merge** as the base. It’s more defensive, observable, and decoupled, with clean typing and routing. If you want the “codemode as tools” developer convenience, consider adding a small adapter that exposes a thin  endpoint on top of the existing runner/bridge without moving the logic into the HTTP server.

### Notes
- This comparison intentionally ignores per‑user containerization and routing. The conclusions above hold for shared Jungle as well.
