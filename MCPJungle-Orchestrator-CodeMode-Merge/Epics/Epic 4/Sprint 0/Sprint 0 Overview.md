# Sprint 0 — Supabase Foundation & Data Access

**Goal**
Establish read-only connectivity to the Supabase `tools` table and set up the local data structures for User Preferences.

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 0)**
```
/orchestrator
  /src
    /discovery
      /supabase
        client.ts               # Supabase connection singleton
        types.ts                # Database types (mirrors DB schema)
        service.ts              # Read-only fetch functions
      /preferences
        types.ts                # UserPreferences interfaces
        store.ts                # Local storage adapter (JSON/SQLite)
    /config
      schema.ts                 # Added SUPABASE_URL, SUPABASE_KEY
  /tests
    /sprint4-0
      supabaseConnection.spec.ts
      supabaseService.spec.ts
      preferencesStore.spec.ts
```

---

## Ticket-4001 — Supabase Client Setup

**What / Why**
Install dependencies and configure the Supabase client with environment variables to ensure we can connect to the remote database.

**Where**
`package.json`, `/src/config/schema.ts`, `/src/discovery/supabase/client.ts`

**Implementation Sketch**
*   Install `@supabase/supabase-js`.
*   Update `config/schema.ts` to require `SUPABASE_URL` and `SUPABASE_KEY`.
*   Export a singleton `getSupabaseClient()` that initializes the client lazily or on startup.

**Tests**
`/tests/sprint4-0/supabaseConnection.spec.ts`:
*   Mock `process.env`.
*   Assert client initializes with correct URL/Key.
*   Assert it throws if config is missing.

**Accept When**
Tests pass; `getSupabaseClient()` returns a valid instance.

**LLM Priming**
`@supabase/supabase-js`, `createClient`, `singleton pattern`, `zod environment validation`

---

## Ticket-4002 — Data Modeling (Types)

**What / Why**
Define TypeScript interfaces that mirror the existing Supabase `tools` table and the new `UserPreferences` structure.

**Where**
`/src/discovery/supabase/types.ts`, `/src/discovery/preferences/types.ts`

**Implementation Sketch**
*   `Tool`: `id` (uuid), `name`, `description`, `price_per_call`, `rating`, `endpoint_url`.
*   `UserPreferences`: `userId`, `maxPriceCap`, `minRatingThreshold`, `discoveryMode` ('auto' | 'manual').

**Tests**
No runtime logic, but ensuring files exist and types compile.

**Accept When**
Types are exported and match the Epic 4 Overview spec.

**LLM Priming**
`TypeScript interfaces`, `Supabase Database Definitions`

---

## Ticket-4003 — Read-Only Tools Service

**What / Why**
Implement functions to fetch tools from Supabase. We need to be able to get all tools (for testing) or specific tools by ID.

**Where**
`/src/discovery/supabase/service.ts`

**Implementation Sketch**
*   `getAllTools()`: `supabase.from('tools').select('*')`.
*   `getToolById(id)`: `supabase.from('tools').select('*').eq('id', id).single()`.
*   Handle errors (network, 404) gracefully.

**Tests**
`/tests/sprint4-0/supabaseService.spec.ts`:
*   Use `nock` or mock the Supabase client.
*   Test successful fetch returns typed `Tool[]`.
*   Test error handling (e.g., DB down).

**Accept When**
Service functions return data matching the `Tool` interface.

**LLM Priming**
`supabase.from().select()`, `PostgrestResponse`, `Error Handling`

---

## Ticket-4004 — User Preferences Store (Supabase)

**What / Why**
Persist user settings in a dedicated Supabase table `user_preferences_orchestrator`. We have permission to create and write to tables with the `_orchestrator` suffix.

**Where**
`/src/discovery/preferences/store.ts`

**Implementation Sketch**
*   Target table: `user_preferences_orchestrator`.
*   `getPreferences(userId)`: SELECT ... single().
*   `setPreferences(userId, prefs)`: UPSERT ...
*   Handle defaults if row missing.

**Tests**
`/tests/sprint4-0/preferencesStore.spec.ts`:
*   Mock Supabase calls.
*   Verify UPSERT logic.

**Accept When**
We can save and load user settings via the Supabase client.

**LLM Priming**
`supabase.from('user_preferences_orchestrator')`, `UPSERT`

---

## Ticket-4005 — Integration Smoke Test

**What / Why**
Verify the whole chain: Config -> Client -> Service -> Real/Mock DB.

**Where**
`/tests/sprint4-0/integrationSmoke.spec.ts`

**Implementation Sketch**
*   Create a test that uses the *real* Supabase client (with a test key or mocked network response) to fetch a known list of tools.
*   Verify the data shape matches our `Tool` type at runtime.

**Tests**
Run the smoke test script.

**Accept When**
The script outputs a valid list of tools without crashing.

**LLM Priming**
`Integration Testing`, `End-to-End verification`

