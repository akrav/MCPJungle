# Epic 4: Dynamic Tool Discovery & Auto-Installation (Supabase + Vector Search)

> **One‑liner**: Enhance the Orchestrator to **dynamically discover and install** MCP tools from a Supabase registry when local tools are insufficient. Using **vector search** on tool descriptions, it finds the best match based on user preferences (rating vs. cost) and provisions it into the user’s segmented instance automatically or via manual approval.

---

## Problem Statement

Currently, the Orchestrator can only expose tools that are already explicitly registered or installed in the user's segmented MCPJungle instance. If an AI agent needs a capability that isn't present (e.g., "Check weather" when no weather tool is installed):
1.  The request fails or the agent hallucinates.
2.  The user must manually search for a tool, configure it, and restart/reload.
3.  There is no automated way to find the "best" tool among many competing implementations (e.g., multiple weather APIs with different costs/ratings).

**We need an intelligent discovery mechanism** that allows the Orchestrator to "self-heal" by finding and installing relevant tools from a central Supabase registry on the fly, while respecting user budgets and quality standards.

---

## Goals & Non‑Goals

### Goals

1.  **Fallback Discovery**: Trigger a search when the agent requests a tool/capability not currently available.
2.  **Vector-Based Lookup**: Use **vector embeddings** of tool descriptions in Supabase to find semantically relevant MCPs.
3.  **User-Controlled Filtering**: Before selection, filter candidates based on strict user constraints:
    *   **Max Price per Call**: "Do not show tools costing more than $0.005."
    *   **Min Rating**: "Do not show tools with a rating below 4.0."
4.  **Smart Selection Modes**:
    *   **Auto Mode**: Automatically pick the best tool from the *filtered* list based on strategy (e.g., "Lowest Cost" or "Highest Rating").
    *   **Manual Mode**: Present the *filtered* list of options to the user and wait for explicit selection.
5.  **Auto-Installation**: Automatically "download" (register) the selected MCP (whether picked by Auto logic or Manual user action) into the user's **segmented MCPJungle instance**.
6.  **Supabase Integration**: Read-only access to existing `tools` table via Supabase MCP/SDK.

### Non‑Goals (Phase 1)

*   No complex bidding systems.
*   No modification of the source `tools` table in Supabase (read-only).
*   No "trying" multiple tools in sequence if the first one fails (pick one and install).

---

## High‑Level Architecture

```
+-------------------------+        +---------------------------+       +----------------------------------+
|  AI Agent (Client)      | -----> |   Orchestrator (Gateway)  | ----> |  User's Segmented MCPJungle      |
|  "I need weather info"  |        |                           |       |  (Hosts active tools)            |
+-------------------------+        +------------+--------------+       +----------------------------------+
                                                |
                                       (Tool Not Found?)
                                                |
                                                v
                                   +---------------------------+
                                   |   Discovery Engine        |
                                   |  (Vector Search & Logic)  |
                                   +------------+--------------+
                                                |
                                                v
                                   +---------------------------+       +----------------------------------+
                                   |      Supabase DB          |       |  Table: tools                    |
                                   | (Registry & Embeddings)   | <---- |  - description (vectorized)      |
                                   +---------------------------+       |  - price_per_call, rating, etc.  |
                                                                       +----------------------------------+
```

**Flows**

1.  **Request Analysis**: Agent asks for a tool. Orchestrator checks local catalog.
2.  **Miss & Search**: If no local match, query Supabase via vector search.
3.  **Filter**: Apply user constraints (Max Price, Min Rating) to remove unsuitable candidates.
4.  **Decision Point**:
    *   **If Auto Mode**: Sort remaining candidates by strategy (Cost vs. Rating) and pick top result.
    *   **If Manual Mode**: Return list of candidates to User (via UI/Console) -> User selects one.
5.  **Install**: "Download" metadata to the user's segmented instance and initialize.
6.  **Execute**: Forward the original request to the newly installed tool.

---

## Key Concepts

*   **Vector Lookup**: Using `pgvector` to match natural language requirements.
*   **Safety Filters**: Hard constraints applied *before* ranking.
    *   `max_price_cap`: Absolute limit on cost per call.
    *   `min_rating_threshold`: Minimum quality score required.
*   **Selection Strategies (Auto Mode)**:
    *   **Lowest Cost**: Prioritize `price_per_call` ascending.
    *   **Highest Rating**: Prioritize `rating` descending.
    *   **Balanced**: Weighted score.
*   **Manual Mode**: A required safety valve. The system pauses and presents options. Critical for cost control.
*   **Per-User Isolation**: The "download" registers the tool in the *specific user's* runtime config.

---

## Components

1.  **Discovery Service**
    *   Interacts with Supabase.
    *   Handles embedding generation and similarity search.
    *   **Filter Logic**: Applies `price < cap` and `rating > threshold`.

2.  **Installer / Provisioner**
    *   Takes a `Tool` record from Supabase.
    *   Updates the configuration of the **User's Segmented MCPJungle Instance**.
    *   Triggers a "refresh" so the Orchestrator sees the new capabilities.

3.  **User Preference Manager**
    *   Stores user settings:
        *   `mode`: 'auto' | 'manual'
        *   `sort_strategy`: 'cheapest' | 'rating'
        *   `max_price`: 0.01
        *   `min_rating`: 4.0

---

## Data Model (Supabase Integration)

**Existing Table (Read-Only): `public.tools`**
*   `id` (uuid)
*   `name`, `description` (vectorized), `endpoint_url`
*   `price_per_call` (float4)
*   `rating` (float/int)

**New Table (Orchestrator Specific): `public.user_preferences_orchestrator`**
*   `user_id` (uuid)
*   `discovery_mode` (enum: 'auto', 'manual')
*   `auto_install_strategy` (enum: 'cheapest', 'rating')
*   `max_price_cap` (float4)
*   `min_rating_threshold` (float4)

---

## MVP Scope & Acceptance Criteria

*   ✅ **Supabase Connection**: Orchestrator reads from `tools` table.
*   ✅ **Vector Search**: Natural language query returns relevant tools.
*   ✅ **Filtering**: System strictly respects `max_price_cap` and `min_rating_threshold` (excludes non-compliant tools).
*   ✅ **Manual Mode**: If configured, system returns a list of options and waits for selection instead of auto-installing.
*   ✅ **Auto Mode**: If configured, system picks best candidate from *filtered* list based on sort strategy.
*   ✅ **Auto-Install Flow**: Selected tool (Auto or Manual) is added to user's segmented instance without restart.

---

## Future Work

*   **Feedback Loop**: Update tool ratings based on success/fail signals.
*   **Caching**: Cache search results.
*   **Commercial Handshake**: Handle payment authorization if the tool is not free.
