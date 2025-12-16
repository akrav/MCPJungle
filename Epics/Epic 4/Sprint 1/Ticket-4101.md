# Ticket-4101 — Embedding Provider Setup

**What / Why**
We need to turn text (user queries or expanded descriptions) into vectors (arrays of numbers) to compare them against the database. We will use OpenAI's embeddings API for this.

**Where**
`/src/discovery/search/embedding.ts`, `/src/config/schema.ts`

**Implementation Sketch**
*   Update `src/config/schema.ts` to include `OPENAI_API_KEY` (string, required).
*   Create `src/discovery/search/embedding.ts`.
*   Export `generateEmbedding(text: string): Promise<number[]>`:
    *   Use `fetch` or `openai` SDK to call `https://api.openai.com/v1/embeddings`.
    *   Model: `text-embedding-3-small` (standard for modern Supabase tutorials, check DB compatibility).
    *   Return: `data[0].embedding`.
*   Error handling: wrap in try/catch, throw typed error.

**Tests**
`/tests/sprint4-1/embedding.spec.ts`:
*   **Case 1**: Mock successful API response -> assert return is number array of correct length.
*   **Case 2**: Mock API 401/500 -> assert throws `EmbeddingError`.

**Accept When**
Function reliably returns a vector for a given string.

**LLM Priming (keywords/APIs)**
`OpenAI Embeddings API`, `text-embedding-3-small`, `vector dimension (1536)`

