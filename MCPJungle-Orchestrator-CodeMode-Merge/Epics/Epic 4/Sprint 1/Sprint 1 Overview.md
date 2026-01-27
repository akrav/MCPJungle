# Sprint 1 — Vector Search Engine (Supabase Native)

**Goal**
Implement semantic search capability using **Supabase's built-in Vector Database** features (`pgvector`) to efficiently find tools that match a generated "ideal tool description."

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 1)**
```
/orchestrator
  /src
    /discovery
      /search
        embedding.ts            # Embedding provider adapter (OpenAI/Local)
        queryExpansion.ts       # LLM prompt to generate "ideal tool" desc
        vectorStore.ts          # Supabase RPC wrapper for similarity search
        index.ts                # Main search service (Facade)
  /tests
    /sprint4-1
      embedding.spec.ts
      queryExpansion.spec.ts
      vectorStore.spec.ts
      searchService.spec.ts
```

---

## Ticket-4101 — Embedding Provider Setup

**What / Why**
We need to turn text (user queries or expanded descriptions) into vectors (arrays of numbers) to compare them against the database.

**Where**
`/src/discovery/search/embedding.ts`, `/src/config/schema.ts`

**Implementation Sketch**
*   Add `OPENAI_API_KEY` to config.
*   Implement `generateEmbedding(text: string): Promise<number[]>` using OpenAI's `text-embedding-3-small` (or compatible model matching DB).
*   Handle API errors and rate limits.

**Tests**
`/tests/sprint4-1/embedding.spec.ts`:
*   Mock OpenAI API response.
*   Assert output is an array of numbers (length 1536 for ada-002/small-3).

**Accept When**
Function returns a vector for a given string.

**LLM Priming**
`OpenAI Embeddings API`, `text-embedding-3-small`, `vector dimension`

---

## Ticket-4102 — Query Expansion (Ideal Tool Description)

**What / Why**
Users often ask vague questions ("check weather"). To get better vector matches, we use an LLM to hallucinate the "Ideal Tool Description" (e.g., "A tool that accepts a city name and returns current temperature, humidity...").

**Where**
`/src/discovery/search/queryExpansion.ts`

**Implementation Sketch**
*   Prompt: "You are an expert at finding APIs. The user wants: '{userQuery}'. Describe the ideal MCP tool (name, description, capabilities) that would solve this. Be precise."
*   Return the generated text description.

**Tests**
`/tests/sprint4-1/queryExpansion.spec.ts`:
*   Mock LLM generation.
*   Input "weather" -> Output contains "temperature", "forecast", etc.

**Accept When**
We can generate a rich description from a short query.

**LLM Priming**
`Prompt Engineering`, `Query Expansion`, `Hypothetical Document Embeddings (HyDE)`

---

## Ticket-4103 — Supabase Vector Search (RPC)

**What / Why**
Execute the similarity search on Supabase using the `match_tools` RPC function. This pushes the compute to the DB.

**Where**
`/src/discovery/search/vectorStore.ts`

**Implementation Sketch**
*   Define interface `MatchToolParams`: `query_embedding`, `match_threshold`, `match_count`.
*   Function `findSimilarTools(vector: number[]): Promise<Tool[]>`:
    *   Call `supabase.rpc('match_tools', { ... })`.
    *   Map results to `Tool` objects.

**Tests**
`/tests/sprint4-1/vectorStore.spec.ts`:
*   Mock `supabase.rpc`.
*   Assert correct parameters passed (threshold, limit).
*   Assert results are returned.

**Accept When**
We can successfully call the RPC and get results.

**LLM Priming**
`supabase.rpc`, `pgvector`, `cosine distance`

---

## Ticket-4104 — Search Service Facade

**What / Why**
Wire it all together: User Query -> Expansion -> Embedding -> RPC Call -> Results.

**Where**
`/src/discovery/search/index.ts`

**Implementation Sketch**
*   `searchTools(userQuery: string): Promise<Tool[]>`
*   Step 1: Expand query (Ticket-4102).
*   Step 2: Embed expanded query (Ticket-4101).
*   Step 3: Call Vector Store (Ticket-4103).
*   Step 4: Return unique tools.

**Tests**
`/tests/sprint4-1/searchService.spec.ts`:
*   Mock sub-components.
*   Verify data flow sequence.

**Accept When**
Input string returns `Tool[]`.

**LLM Priming**
`Service Facade`, `Orchestration`, `Dependency Injection`

---

## Ticket-4105 — Integration Search Smoke

**What / Why**
Test the full pipeline against real/mocked external services to ensure end-to-end functionality.

**Where**
`/tests/sprint4-1/integrationSearch.spec.ts`

**Implementation Sketch**
*   "I need to calculate a sum" -> Expansion -> Embedding -> DB Lookup -> Returns "Calculator Tool".

**Tests**
Integration test script.

**Accept When**
Smoke test passes.

**LLM Priming**
`E2E Testing`

