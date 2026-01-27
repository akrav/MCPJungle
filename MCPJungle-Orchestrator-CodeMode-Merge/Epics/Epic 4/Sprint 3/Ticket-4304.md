# Ticket-4304 — Auto-Install Wiring

**What / Why**
Connect the Selection Service (Sprint 2) to the Installer (Sprint 3). This closes the loop: Search -> Select -> Install.

**Where**
`/src/discovery/index.ts` (Main Entry Point)

**Implementation Sketch**
*   Create `/src/discovery/index.ts`.
*   Import `searchTools` (Sprint 1), `selectBestTool` (Sprint 2), `installTool` (Sprint 3, Ticket-4302).
*   Export `resolveMissingTool(userId: string, query: string): Promise<boolean>`.
*   **Logic**:
    1.  `tools = await searchTools(query)`
    2.  `prefs = await getPreferences(userId)` (from Sprint 0)
    3.  `selection = selectBestTool(tools, prefs)`
    4.  If `selection.mode === 'auto'` AND `selection.autoSelected`:
        *   `await installTool(userId, selection.autoSelected)`
        *   Return `true`.
    5.  Else: Return `false` (Manual mode/No match - handled in Sprint 4).

**Tests**
`/tests/sprint4-3/autoInstallFlow.spec.ts`:
*   **Mock** Search returning valid tools.
*   **Mock** Selection returning an auto-winner.
*   **Mock** Installer (spy).
*   **Test**: Call `resolveMissingTool`.
*   **Assert**: Installer spy was called. Function returns `true`.

**Accept When**
The full pipeline is connected function-to-function.

**LLM Priming (keywords/APIs)**
`Orchestration`, `Pipeline Pattern`, `Async/Await`
