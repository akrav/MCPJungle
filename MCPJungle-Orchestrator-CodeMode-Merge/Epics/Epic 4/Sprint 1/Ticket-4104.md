# Ticket-4104 — Search Service Facade

**What / Why**
Wire the individual components together into a single service that the Orchestrator can call. This isolates the complexity of expansion -> embedding -> search.

**Where**
`/src/discovery/search/index.ts`

**Implementation Sketch**
*   Export `searchTools(userQuery: string): Promise<Tool[]>`.
*   **Step 1**: Call `expandQuery(userQuery)` to get the "ideal description".
*   **Step 2**: Call `generateEmbedding(expandedDescription)` to get the vector.
*   **Step 3**: Call `findSimilarTools(vector)` to get candidates.
*   **Step 4**: Return the candidates.
*   (Optional): Log the expanded query and match scores for debugging.

**Tests**
`/tests/sprint4-1/searchService.spec.ts`:
*   Mock `expandQuery`, `generateEmbedding`, `findSimilarTools`.
*   Verify the data flow: Query -> Expanded -> Vector -> Results.
*   Verify that if expansion fails, we might try searching with the raw query (fallback logic, optional for MVP).

**Accept When**
Input string returns `Tool[]` correctly processed through the pipeline.

**LLM Priming (keywords/APIs)**
`Service Facade`, `Orchestration`, `Dependency Injection`, `Fallback Strategy`

