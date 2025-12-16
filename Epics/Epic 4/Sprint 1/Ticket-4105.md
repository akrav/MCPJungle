# Ticket-4105 — Integration Search Smoke

**What / Why**
Test the full pipeline against real/mocked external services to ensure end-to-end functionality. This confirms that our embedding model matches what the DB expects and that the RPC call signature is correct.

**Where**
`/tests/sprint4-1/integrationSearch.spec.ts`

**Implementation Sketch**
*   **Env Check**: Skip if `OPENAI_API_KEY` or `SUPABASE_URL` are missing.
*   **Scenario**:
    1.  User query: "I need to perform basic math addition".
    2.  Call `SearchService.searchTools(query)`.
    3.  Assert at least one tool is returned (assuming the DB has a "Calculator" or "Math" tool).
    4.  Log the name of the found tool.

**Tests**
Run the smoke test script:
`npm run test -- tests/sprint4-1/integrationSearch.spec.ts`

**Accept When**
Smoke test passes and prints a relevant tool name.

**LLM Priming (keywords/APIs)**
`Integration Testing`, `E2E Testing`, `Smoke Test`

