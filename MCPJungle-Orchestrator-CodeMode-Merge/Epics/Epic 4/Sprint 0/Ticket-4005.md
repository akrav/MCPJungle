# Ticket-4005 — Integration Smoke Test

**What / Why**
Verify the whole chain works with the *real* Supabase instance (or a high-fidelity mock). This ensures our config, client, and types align with reality.

**Where**
`/tests/sprint4-0/integrationSmoke.spec.ts`

**Implementation Sketch**
*   This test should likely be skipped if `SUPABASE_URL` is not set (e.g., in CI without secrets).
*   Call `SupabaseService.getAllTools()`.
*   Assert that the result is an array.
*   Assert that the first item (if exists) has a valid UUID `id` and non-empty `name`.

**Tests**
Run the smoke test script:
`export SUPABASE_URL=...; export SUPABASE_KEY=...; npm run test -- tests/sprint4-0/integrationSmoke.spec.ts`

**Accept When**
The script outputs a valid list of tools without crashing when connected to a real/mock instance.

**LLM Priming (keywords/APIs)**
`Integration Testing`, `End-to-End verification`, `Conditional Test Skip`

