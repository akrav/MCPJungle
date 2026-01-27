# Ticket-4302 — Tool Installer (Runtime Refresh)

**What / Why**
After saving the tool (Ticket-4301), we must notify the running Orchestrator to reload its configuration so the tool is immediately usable without a restart.

**Where**
`/src/discovery/provisioning/installer.ts` (Part 2)

**Implementation Sketch**
*   Import `persistToolConfig` (from Ticket-4301).
*   Export `installTool(userId: string, tool: Tool): Promise<void>`.
*   **Logic**:
    1.  Call `await persistToolConfig(userId, tool)`.
    2.  Call the Router's refresh method (e.g., `Router.reloadConfig(userId)` or `Cache.invalidate(userId)`).
    3.  Log "Tool {name} installed and router refreshed."

**Tests**
`/tests/sprint4-3/installer_runtime.spec.ts`:
*   **Spy**: On the Router/Cache refresh method.
*   **Test**: Call `installTool`.
*   **Assert**: Persistence is called first, then Refresh is called.

**Accept When**
The system updates its in-memory state after installing a tool.

**LLM Priming (keywords/APIs)**
`Hot Reloading`, `Cache Invalidation`, `Event Bus`
