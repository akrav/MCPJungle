# Ticket-4203 — Selection Service Facade

**What / Why**
Combine filtering and ranking into a single callable service. This service encapsulates the business logic of "Making a Decision" and prepares the result for the Orchestrator.

**Where**
`/src/discovery/selection/index.ts`

**Implementation Sketch**
*   Define `SelectionResult`:
    ```typescript
    interface SelectionResult {
      candidates: Tool[];
      autoSelected: Tool | null; // The chosen one (if auto mode)
      mode: 'auto' | 'manual';
    }
    ```
*   Export `selectBestTool(tools: Tool[], prefs: UserPreferences): SelectionResult`.
*   **Logic**:
    1.  Call `filterTools(tools, prefs)`.
    2.  Call `rankTools(filtered, prefs.autoInstallStrategy)`.
    3.  Construct result:
        *   `candidates`: The filtered and ranked list.
        *   `mode`: `prefs.discoveryMode`.
        *   `autoSelected`: If `mode === 'auto'` AND `candidates.length > 0`, take `candidates[0]`. Else `null`.

**Tests**
`/tests/sprint4-2/selectionService.spec.ts`:
*   **Scenario Auto**: Prefs say 'auto'. Assert `autoSelected` is the top tool.
*   **Scenario Manual**: Prefs say 'manual'. Assert `autoSelected` is null, but `candidates` are populated.
*   **Scenario No Match**: All tools filtered out. Assert `candidates` empty, `autoSelected` null.

**Accept When**
The service correctly orchestrates filtering and ranking based on preferences.

**LLM Priming (keywords/APIs)**
`Facade Pattern`, `Business Logic Layer`, `Dependency Injection`

