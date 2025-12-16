# Ticket-4301 — Tool Installer (Persistence)

**What / Why**
Implement the logic to save a new tool to the user's permanent configuration (Database or Manifest). This ensures the tool is still there if the server restarts.

**Where**
`/src/discovery/provisioning/installer.ts` (Part 1)

**Implementation Sketch**
*   Create `/src/discovery/provisioning/installer.ts`.
*   Export `persistToolConfig(userId: string, tool: Tool): Promise<void>`.
*   **Logic**:
    *   Map the Supabase `Tool` object to the local config format (e.g., `canonicalName = tool.name + '__' + tool.id`).
    *   Perform an UPSERT to the `user_tools` table (or write to `user_{id}_tools.json` depending on the architecture).

**Tests**
`/tests/sprint4-3/installer_persistence.spec.ts`:
*   **Mock DB**: Mock the table update.
*   **Test**: Call `persistToolConfig`.
*   **Assert**: The correct data is sent to the DB/File.

**Accept When**
The tool record is successfully saved to storage.

**LLM Priming (keywords/APIs)**
`Configuration Management`, `Upsert`, `Persistence Layer`

