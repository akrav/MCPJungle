# Sprint Planning for Epic 4: Dynamic Tool Discovery

This document outlines the sprint roadmap for implementing dynamic tool discovery via Supabase, vector search, and auto-installation.

---

# Sprint 0 — Supabase Foundation & Data Access

**Goal**
Establish read-only connectivity to the Supabase `tools` table and set up the local data structures for User Preferences.

**Scope / Deliverables**
*   **Supabase Integration**: Set up the Supabase client (or Supabase MCP connection) within the Orchestrator.
*   **Data Modeling**: Define TypeScript interfaces for `Tool` (matching the DB schema) and `UserPreferences` (local or DB-backed).
*   **Read Access**: Implement and test a function to fetch raw rows from the `tools` table (e.g., `getToolById`, `getAllTools`).
*   **Preference Store**: Create a lightweight store (e.g., local JSON or SQLite table) for `user_preferences_orchestrator` to hold `max_price_cap`, `min_rating_threshold`, etc.

**LLM Priming Cues**
*   "Supabase JS Client" or "Supabase MCP".
*   "Read-only access pattern."
*   "TypeScript Interfaces vs DB Schema."

**Exit Criteria**
*   Orchestrator can authenticate and log a list of tools from Supabase.
*   User preferences can be saved and retrieved locally.

**In plain English**
> Lay the plumbing. Connect the Orchestrator to the Supabase database so we can see what tools are available, and set up a place to save user settings like "max price."

---

# Sprint 1 — Vector Search Engine (Supabase Native)

**Goal**
Implement semantic search capability using **Supabase's built-in Vector Database** features (`pgvector`) to efficiently find tools that match a generated "ideal tool description."

**Scope / Deliverables**
*   **Query Transformation**: Implement a step to convert the user's raw need (e.g., "I need weather") into a comprehensive "Ideal Tool Description" string (e.g., "A tool that provides current weather conditions and forecasts...").
*   **Query Embedding**: Use an embedding provider (compatible with stored vectors) to vectorize this "Ideal Tool Description."
*   **Supabase Vector Search**: Execute a remote procedure call (RPC) to Supabase's `match_documents` (or equivalent) function.
    *   *Note*: We leverage Supabase's pre-indexed vector store; we do **not** scan/vectorize the database rows on the fly.
*   **Search Service**: Create `searchTools(queryDescription: string)` which returns ranked matches based on cosine similarity.

**LLM Priming Cues**
*   "Supabase Vector Store / pgvector."
*   "Generative Search Query (Query Expansion)."
*   "RPC `match_documents` function."

**Exit Criteria**
*   The system takes a vague intent, generates a rich description, vectorizes it, and retrieves the correct tool from Supabase using the native vector index.
*   Unit tests for the Query Expansion -> Embedding -> Search pipeline.

**In plain English**
> Use Supabase's brain. We describe what the perfect tool would look like, turn that description into a vector, and ask Supabase to "find the tool description mathematically closest to this one" using its built-in index.

---

# Sprint 2 — Logic Layer: Filtering & Ranking

**Goal**
Implement the decision engine that filters search results based on user safety constraints and sorts them by preference.

**Scope / Deliverables**
*   **Filtering**: Apply hard constraints: exclude tools where `price > max_price_cap` or `rating < min_rating_threshold`.
*   **Ranking Strategies**: Implement sorting logic for:
    *   `Auto (Lowest Cost)`: Sort by `price_per_call` ASC.
    *   `Auto (Highest Rating)`: Sort by `rating` DESC.
    *   `Balanced`: Weighted scoring.
*   **Selection Service**: A wrapper that takes `searchResults` + `UserPreferences` and returns `candidateList` (sorted) and `selectionMode` (Auto vs Manual).

**LLM Priming Cues**
*   "Filter-Map-Reduce pattern."
*   "Strategy Pattern for sorting."
*   "Business logic isolation."

**Exit Criteria**
*   Test cases prove that expensive tools are dropped when `max_price_cap` is low.
*   Test cases prove that sorting changes based on user preference (Cost vs Rating).

**In plain English**
> Add the rules. Make sure we never show or pick a tool that is too expensive or too poorly rated, and put the "best" ones at the top of the list.

---

# Sprint 3 — Orchestrator Hook & Auto-Install

**Goal**
Wire the discovery logic into the Orchestrator's request flow and implement the "Auto-Install" mechanism, including robust handling for when **no tool is found**.

**Scope / Deliverables**
*   **Error Interception**: Modify the Orchestrator's router to catch "Tool Not Found" / 404 errors.
*   **Discovery Trigger**: Call the Discovery Service (Sprints 1 & 2) when a tool is missing.
*   **Edge Case Handling (No Match)**: Explicitly handle the scenario where Supabase returns **zero results** (or all are filtered out by safety caps).
    *   Action: Return a clear, final error to the Agent ("Capability not found in registry"), preventing infinite retry loops.
*   **Auto-Provisioning**: Implement the logic to "install" the selected `Tool` into the user's **Segmented MCPJungle Instance** (update config/manifest and reload).
*   **Retry Loop**: Automatically retry the original user request *only* if a tool was successfully found and installed.

**LLM Priming Cues**
*   "Middleware / Interceptor pattern."
*   "Hot-reloading configuration."
*   "Self-healing systems."
*   "Graceful Failure patterns."

**Exit Criteria**
*   A request for a missing tool (that exists) automatically succeeds.
*   A request for a non-existent tool (e.g., "Time Travel API") searches Supabase, finds nothing, and correctly reports failure to the agent without crashing or hanging.

**In plain English**
> Close the loop, but know when to quit. If the agent asks for a tool we don't have, go look for it. If we find it, install it and run. If Supabase doesn't have it either, tell the agent "Sorry, I looked everywhere but couldn't find it."

---

# Sprint 4 — Manual Mode & Interaction

**Goal**
Implement the "Human-in-the-loop" flow for cases where the user wants to manually select from options.

**Scope / Deliverables**
*   **Interaction Hook**: When `discovery_mode === 'manual'`, pause the flow and output a list of candidates.
*   **User Interface**: Implement a mechanism for the user to select an option (CLI prompt, special API response, or pending state). *For MVP, a CLI prompt or a specific "Approval Request" error response is acceptable.*
*   **Resume Flow**: Once a selection is made, trigger the Provisioning logic (from Sprint 3) and resume the request.

**LLM Priming Cues**
*   "Async / Await interaction."
*   "Approval workflow."
*   "CLI prompts / inquirer."

**Exit Criteria**
*   System stops and asks for confirmation/selection when in Manual Mode.
*   Selecting an option completes the install and execution.

**In plain English**
> Ask for permission. If the user wants control, show them the options ("Tool A is cheap," "Tool B is 5 stars") and wait for them to pick one before installing.

---

# Sprint 5 — E2E Validation & Hardening

**Goal**
Finalize the epic with comprehensive end-to-end testing, error handling, and documentation.

**Scope / Deliverables**
*   **Edge Cases**:
    *   **"No tools found"**: Verify system behaves correctly when Supabase returns empty.
    *   **"All tools filtered"**: Verify system fails gracefully when matches exist but are too expensive/low-rated.
    *   **"Installation failed"**: Handle transient errors during provision.
*   **Performance**: measure latency added by the search loop; optimize if necessary.
*   **Documentation**: Update user guides on how to configure `UserPreferences` and how the discovery mechanism works.
*   **Integration Tests**: Full suite covering Auto Mode, Manual Mode, and Filtering.

**LLM Priming Cues**
*   "Integration Testing."
*   "Error Handling & Graceful Degradation."
*   "User Documentation."

**Exit Criteria**
*   All tests green.
*   Latency for "Tool Not Found" recovery is within acceptable limits (< 3s).
*   System handles the "No Matching Tool" scenario deterministically.

**In plain English**
> Polish it up. Make sure it handles errors gracefully (like if no tool exists or they are all too expensive) and doesn't slow things down too much. Write the manual.

