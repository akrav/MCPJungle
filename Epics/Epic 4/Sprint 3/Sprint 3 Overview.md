# Sprint 3 — Orchestrator Hook & Auto-Install

**Goal**
Wire the discovery logic into the Orchestrator's request flow and implement the "Auto-Install" mechanism, including robust handling for when **no tool is found**.

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 3)**
```
/orchestrator
  /src
    /discovery
      /provisioning
        installer.ts            # Updates user config to add new tool
        index.ts                # Provisioning Service Facade
    /server
      router.ts                 # (Existing) Update to catch 404/ToolNotFound
      interceptor.ts            # NEW: Discovery Middleware
  /tests
    /sprint4-3
      installer.spec.ts
      interceptor.spec.ts
      autoInstallFlow.spec.ts
```

---

## Ticket-4301 — Tool Installer (Persistence)

**What / Why**
Implement the logic to save a new tool to the user's permanent configuration (Database or Manifest).

**Where**
`/src/discovery/provisioning/installer.ts` (Part 1)

**Tests**
`/tests/sprint4-3/installer_persistence.spec.ts`

---

## Ticket-4302 — Tool Installer (Runtime Refresh)

**What / Why**
Notify the running Orchestrator to reload its configuration so the tool is immediately usable.

**Where**
`/src/discovery/provisioning/installer.ts` (Part 2)

**Tests**
`/tests/sprint4-3/installer_runtime.spec.ts`

---

## Ticket-4303 — Discovery Interceptor (Middleware)

**What / Why**
We need to catch requests for tools that don't exist yet. Instead of failing immediately, we intercept the error and trigger the discovery process.

**Where**
`/src/server/interceptor.ts`, `/src/server/router.ts`

**Implementation Sketch**
*   Create a middleware/interceptor function `handleToolNotFound(req, res, next)`.
*   Check if the error is "Tool Not Found".
*   If so, extract the user query/intent from the request.
*   Call `DiscoveryService` (from previous sprints).
*   If a tool is found and auto-installed, retry the request (or return a "Try Again" signal).
*   If **NO** tool is found (Supabase returns 0 matches), return a clean `404` / `MethodNotFound` error to the agent to stop the loop.

**Tests**
`/tests/sprint4-3/interceptor.spec.ts`

**Accept When**
The system attempts discovery on 404, but fails gracefully if nothing is found.

**LLM Priming**
`Express Error Middleware`, `Request Interception`

---

## Ticket-4304 — Auto-Install Wiring

**What / Why**
Connect the Selection Service (Sprint 2) to the Installer (Ticket 4301/4302). This closes the loop: Search -> Select -> Install.

**Where**
`/src/discovery/index.ts` (Main Entry Point)

**Implementation Sketch**
*   Export `resolveMissingTool(userId: string, query: string): Promise<boolean>`.
*   Flow:
    1.  `tools = await searchTools(query)` (Sprint 1)
    2.  `result = selectBestTool(tools, prefs)` (Sprint 2)
    3.  If `result.mode === 'auto'` AND `result.autoSelected`:
        *   `await installTool(userId, result.autoSelected)`
        *   Return `true` (success).
    4.  Else: Return `false` (manual mode or no match).

**Tests**
`/tests/sprint4-3/autoInstallFlow.spec.ts`

**Accept When**
The full pipeline is connected function-to-function.

**LLM Priming**
`Orchestration`, `Pipeline Pattern`

---

## Ticket-4305 — Retry Mechanism

**What / Why**
After installing the tool, the original user request (e.g., "Get Weather") hasn't been executed yet. We need to re-run it automatically so the user experience is seamless.

**Where**
`/src/server/interceptor.ts`

**Implementation Sketch**
*   Inside the interceptor, if `resolveMissingTool` returns `true`:
    *   Re-dispatch the original request to the internal router.
    *   (Careful) Add a recursion limit (e.g., max 1 retry) to prevent infinite loops if the installed tool still fails.

**Tests**
`/tests/sprint4-3/interceptor.spec.ts` (update)

**Accept When**
User sends 1 request -> System installs tool -> User gets valid response.

**LLM Priming**
`Request Replay`, `Idempotency`, `Recursion Guard`
