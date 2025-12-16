# Ticket-4501 — E2E Test: Auto Mode Happy Path

**What / Why**
Verify the core value proposition: A user in "Auto Mode" requests a missing tool, and the system finds, installs, and executes it without intervention. This confirms Sprints 1, 2, and 3 are working together correctly.

**Where**
`/tests/sprint4-5/e2e_auto_mode.spec.ts`

**Implementation Sketch**
*   **Setup**:
    *   Mock `SupabaseClient` to return a valid "Weather Tool" when searched.
    *   Mock `UserPreferences` to `mode: 'auto'`, `strategy: 'cheapest'`.
    *   Mock `Installer` (Spy) to confirm it gets called.
*   **Action**: Simulate an incoming request `POST /mcp` with method `weather_get`.
*   **Assertions**:
    1.  Interceptor catches the 404.
    2.  Discovery Service is called.
    3.  Selection picks the tool.
    4.  Installer is called.
    5.  Request is retried (mocking the *next* call to succeed or verifying the retry logic trigger).

**Tests**
`npm run test -- tests/sprint4-5/e2e_auto_mode.spec.ts`

**Accept When**
The test passes consistently (no flakes).

**LLM Priming (keywords/APIs)**
`Integration Testing`, `Happy Path`, `System Test`, `Spy/Mocking`

