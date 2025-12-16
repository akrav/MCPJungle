# Ticket-4204 — Logic Layer Integration Test

**What / Why**
Verify that real data objects flow correctly through the entire logic chain. This ensures that the interaction between filtering, ranking, and the facade works as intended on realistic data.

**Where**
`/tests/sprint4-2/logicIntegration.spec.ts`

**Implementation Sketch**
*   **Setup**: Create a `UserPreferences` object (e.g., Cap: $0.05, MinRating: 4.0, Strategy: 'cheapest', Mode: 'auto').
*   **Data**: Mock a list of 5-10 tools covering various edge cases (Free, Expensive, Low Rated, Perfect).
*   **Execution**: Call `SelectionService.selectBestTool`.
*   **Assertion**:
    *   Verify the "Expensive" and "Low Rated" tools are gone from `candidates`.
    *   Verify the "Perfect" (Cheap & Good) tool is `autoSelected`.

**Tests**
Run the test script:
`npm run test -- tests/sprint4-2/logicIntegration.spec.ts`

**Accept When**
Complex scenarios (filtering + sorting) produce the correct winner.

**LLM Priming (keywords/APIs)**
`Integration Testing`, `Scenario-based Testing`, `Data Flow Verification`

