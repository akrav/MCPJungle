# Ticket-4102 — Query Expansion (Ideal Tool Description)

**What / Why**
Users often ask vague questions ("check weather"). A raw semantic search for "check weather" might miss a tool named "Atmospheric Data Service" if the description is technical. By using an LLM to hallucinate the "Ideal Tool Description" (e.g., "A tool that accepts a city name and returns current temperature, humidity..."), we match against the *capabilities* described in the DB.

**Where**
`/src/discovery/search/queryExpansion.ts`

**Implementation Sketch**
*   Export `expandQuery(userQuery: string): Promise<string>`.
*   Use OpenAI Chat Completion (reuse config/client).
*   **Prompt**:
    > "You are an expert at finding APIs. The user wants: '{userQuery}'. Describe the ideal MCP tool (name, description, capabilities) that would solve this. Be precise and use technical keywords. Do not output anything else."
*   Return the `content` of the response.

**Tests**
`/tests/sprint4-1/queryExpansion.spec.ts`:
*   Mock LLM response.
*   Input "weather" -> Assert output contains key terms like "temperature", "forecast".

**Accept When**
We can generate a rich description from a short query.

**LLM Priming (keywords/APIs)**
`Prompt Engineering`, `Query Expansion`, `Hypothetical Document Embeddings (HyDE)`, `Chat Completion API`

