# Ticket-4103 — Supabase Vector Search (RPC)

**What / Why**
Execute the similarity search on Supabase using a remote procedure call (RPC). We assume the database has a `match_tools` function exposed that takes a vector and returns rows ordered by similarity.

**Where**
`/src/discovery/search/vectorStore.ts`

**Implementation Sketch**
*   Define `MatchParams`:
    ```typescript
    interface MatchParams {
      query_embedding: number[];
      match_threshold: number; // e.g., 0.7
      match_count: number;     // e.g., 10
    }
    ```
*   Export `findSimilarTools(embedding: number[]): Promise<Tool[]>`.
*   Call `supabase.rpc('match_tools', { query_embedding: embedding, match_threshold: 0.5, match_count: 5 })`.
*   Map the returned data (which might vary slightly from `Tool`) to our domain `Tool` objects.

**Tests**
`/tests/sprint4-1/vectorStore.spec.ts`:
*   Mock `supabase.rpc`.
*   **Case 1**: RPC returns 3 rows -> assert 3 `Tool` objects returned.
*   **Case 2**: RPC returns null/error -> assert empty array or throw.

**Accept When**
We can successfully call the RPC and get results.

**LLM Priming (keywords/APIs)**
`supabase.rpc`, `pgvector`, `cosine distance`, `match_documents`

