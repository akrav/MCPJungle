# Ticket-4003 — Read-Only Tools Service

**What / Why**
Implement functions to fetch tools from Supabase. We need to be able to get all tools (for testing) or specific tools by ID to verify connectivity and data mapping.

**Where**
`/src/discovery/supabase/service.ts`

**Implementation Sketch**
*   Import the singleton from `client.ts` and types from `types.ts`.
*   `getAllTools()`: `await supabase.from('tools').select('*')`. Return `data` as `Tool[]`.
*   `getToolById(id: string)`: `await supabase.from('tools').select('*').eq('id', id).single()`.
*   Wrap calls in try/catch to rethrow mapped errors (e.g., "SupabaseConnectionError").

**Tests**
`/tests/sprint4-0/supabaseService.spec.ts`:
*   Use a mocking library (like `nock` or Jest mocks on the supabase client) to simulate a successful response from Supabase.
*   Assert that the returned data is correctly typed as `Tool[]`.
*   Simulate a network error and assert that the service throws a clean error.

**Accept When**
Service functions return data matching the `Tool` interface and tests pass.

**LLM Priming (keywords/APIs)**
`supabase.from().select()`, `PostgrestResponse`, `Error Handling`, `Service Layer`

