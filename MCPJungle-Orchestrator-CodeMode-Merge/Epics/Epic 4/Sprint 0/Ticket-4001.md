# Ticket-4001 — Supabase Client Setup

**What / Why**
Install dependencies and configure the Supabase client with environment variables to ensure we can connect to the remote database.

**Where**
`package.json`, `/src/config/schema.ts`, `/src/discovery/supabase/client.ts`

**Implementation Sketch**
*   Install `@supabase/supabase-js`.
*   Update `config/schema.ts` (Zod) to require `SUPABASE_URL` and `SUPABASE_KEY` (service role or anon key depending on security model, likely service for backend).
*   Create `/src/discovery/supabase/client.ts` which exports a singleton `getSupabaseClient()` or `supabase` instance.
*   Ensure it throws a clear error if env vars are missing during initialization.

**Tests**
`/tests/sprint4-0/supabaseConnection.spec.ts`:
*   **Case 1**: Mock `process.env` with valid values -> assert `createClient` was called.
*   **Case 2**: Mock `process.env` with missing values -> assert `loadConfig` or client init throws Zod error.

**How to run**
`npm install @supabase/supabase-js`
`npm run test -- tests/sprint4-0/supabaseConnection.spec.ts`

**Accept When**
Tests pass; `getSupabaseClient()` returns a valid instance when config is correct.

**LLM Priming (keywords/APIs)**
`@supabase/supabase-js`, `createClient`, `singleton pattern`, `zod environment validation`

