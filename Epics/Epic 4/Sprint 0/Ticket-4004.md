# Ticket-4004 — User Preferences Store (Supabase)

**What / Why**
Persist user settings (like `max_price_cap`) in a dedicated Supabase table `user_preferences_orchestrator`. We have write access to tables with the `_orchestrator` suffix, allowing us to manage state without modifying existing core tables.

**Where**
`/src/discovery/preferences/store.ts`

**Implementation Sketch**
*   **Schema Definition** (Documented for creation via SQL/Dashboard):
    *   Table: `user_preferences_orchestrator`
    *   Columns: `user_id` (uuid, PK), `discovery_mode` (text), `auto_install_strategy` (text), `max_price_cap` (float), `min_rating_threshold` (float).
*   **Store Implementation**:
    *   `get(userId)`: `supabase.from('user_preferences_orchestrator').select('*').eq('user_id', userId).single()`.
    *   `set(userId, prefs)`: `supabase.from('user_preferences_orchestrator').upsert({ user_id: userId, ...prefs })`.
*   **Defaults**: If `get` returns no rows (406/null), return safe defaults (`mode: 'manual'`, `cap: 0.01`).

**Tests**
`/tests/sprint4-0/preferencesStore.spec.ts`:
*   **Mock Supabase**: Mock the `select` and `upsert` calls.
*   **Defaults**: Assert that when Supabase returns null/error, defaults are returned.
*   **Upsert**: Assert `set` calls upsert with correct payload.

**Accept When**
Code interacts correctly with the `user_preferences_orchestrator` table via the Supabase client.

**LLM Priming (keywords/APIs)**
`supabase.from().upsert()`, `Postgres UPSERT`, `Repository Pattern`, `_orchestrator table suffix`
