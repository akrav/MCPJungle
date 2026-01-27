# Ticket-4504 — Edge Case: Installation Failure

**What / Why**
What if we select a tool, but the "Installation" step fails (e.g., config write error, or invalid tool manifest)? The system must not crash or leave the user in a broken state.

**Where**
`/tests/sprint4-5/edge_cases.spec.ts`

**Implementation Sketch**
*   **Setup**: Mock `installTool` to throw `new Error("Disk Full")`.
*   **Action**: Trigger discovery (Auto Mode).
*   **Assert**:
    *   The error is caught in the Interceptor/Service.
    *   Error is logged.
    *   User receives a 500 or specific error message ("Discovery failed: Installation error").
    *   System process remains alive.

**Tests**
`npm run test -- tests/sprint4-5/edge_cases.spec.ts` (append scenario)

**Accept When**
System handles internal failures without crashing the process.

**LLM Priming (keywords/APIs)**
`Fault Tolerance`, `Exception Handling`, `Resilience`

