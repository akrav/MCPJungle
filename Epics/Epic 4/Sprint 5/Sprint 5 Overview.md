# Sprint 5 — E2E Validation & Hardening

**Goal**
Finalize the epic with comprehensive end-to-end testing, error handling, and documentation. We must prove the system works reliably in "happy paths" (Auto Mode, Manual Mode) and "sad paths" (No Tools Found, User Reject, Supabase Down).

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 5)**
```
/orchestrator
  /tests
    /sprint4-5
      e2e_auto_mode.spec.ts     # Full Auto Mode Flow
      e2e_manual_mode.spec.ts   # Full Manual Mode Flow
      edge_cases.spec.ts        # Error scenarios (No match, filtered out)
  /docs
    DISCOVERY.md                # User Guide
```

---

## Ticket-4501 — E2E Test: Auto Mode Happy Path

**What / Why**
Verify the core value proposition: A user in "Auto Mode" requests a missing tool, and the system finds, installs, and executes it without intervention.

**Where**
`/tests/sprint4-5/e2e_auto_mode.spec.ts`

**Tests**
Run the spec.

**Accept When**
The test passes consistently (no flakes).

**LLM Priming**
`Integration Testing`, `Happy Path`

---

## Ticket-4502 — E2E Test: Manual Mode Happy Path

**What / Why**
Verify the "Human-in-the-loop" works. A user in "Manual Mode" requests a missing tool, the system pauses, the admin API is called, and the system resumes.

**Where**
`/tests/sprint4-5/e2e_manual_mode.spec.ts`

**Tests**
Run the spec.

**Accept When**
The flow works: Request -> Pause -> Admin Select -> Success.

**LLM Priming**
`Asynchronous Testing`, `Stateful Testing`

---

## Ticket-4503 — Edge Case: No Matches Found

**What / Why**
Ensure the system behaves gracefully when Supabase has no relevant tools (or all are filtered out by safety caps). The agent should receive a clear error, not hang or crash.

**Where**
`/tests/sprint4-5/edge_cases.spec.ts`

**Tests**
Run the spec.

**Accept When**
System correctly identifies "nothing to install" and gives up gracefully.

**LLM Priming**
`Negative Testing`, `Error Boundaries`

---

## Ticket-4504 — Edge Case: Installation Failure

**What / Why**
What if we select a tool, but the "Installation" step fails (e.g., config write error, or invalid tool manifest)?

**Where**
`/tests/sprint4-5/edge_cases.spec.ts` (add scenario)

**Tests**
Run the spec.

**Accept When**
System handles internal failures without crashing the process.

**LLM Priming**
`Fault Tolerance`, `Exception Handling`

---

## Ticket-4505 — Documentation: Config & Auto Mode

**What / Why**
Write the documentation for setting up the feature and understanding how Auto Mode works.

**Where**
`/docs/DISCOVERY.md`

**Accept When**
Docs clearly explain how to turn on the feature and set price caps.

**LLM Priming**
`Technical Writing`, `Configuration Guide`

---

## Ticket-4506 — Documentation: Manual Mode & Troubleshooting

**What / Why**
Write the documentation for using Manual Mode (cli interactions) and debugging common issues.

**Where**
`/docs/DISCOVERY.md`

**Accept When**
Docs clearly explain how to manually select a tool and what to do when things break.

**LLM Priming**
`Runbook`, `Troubleshooting Guide`
