# Sprint 2 — Logic Layer: Filtering & Ranking

**Goal**
Implement the decision engine that filters search results based on user safety constraints (Max Price, Min Rating) and sorts them according to the user's preferred strategy (Lowest Cost, Highest Rating, or Balanced).

**Sprint Rule of Engagement**
Do tickets **in order**. For each ticket: write code → write tests → **run tests** → fix until green → **commit & push**. If tests fail, **loop & debug** until green.

**Repo Layout (Additions for Sprint 2)**
```
/orchestrator
  /src
    /discovery
      /selection
        filters.ts              # Hard constraints (Price/Rating)
        ranking.ts              # Sorting logic (Strategy Pattern)
        index.ts                # Selection Service Facade
  /tests
    /sprint4-2
      filters.spec.ts
      ranking.spec.ts
      selectionService.spec.ts
```

---

## Ticket-4201 — Safety Filters Implementation

**What / Why**
Before we rank tools, we must remove any that violate the user's hard constraints. This prevents accidental overspending or usage of low-quality tools.

**Where**
`/src/discovery/selection/filters.ts`

**Implementation Sketch**
*   Export `filterTools(tools: Tool[], prefs: UserPreferences): Tool[]`.
*   Logic:
    *   Exclude if `tool.price_per_call > prefs.maxPriceCap`.
    *   Exclude if `tool.rating < prefs.minRatingThreshold`.

**Tests**
`/tests/sprint4-2/filters.spec.ts`:
*   Input: Mixed list of cheap/expensive and good/bad tools.
*   Assert: Only compliant tools remain.

**Accept When**
Tools exceeding caps are reliably removed.

**LLM Priming**
`Array.filter`, `Predicate Function`, `Safety Constraints`

---

## Ticket-4202 — Ranking Strategies (Cost/Rating)

**What / Why**
Sort the remaining tools based on what the user values most.

**Where**
`/src/discovery/selection/ranking.ts`

**Implementation Sketch**
*   Export `rankTools(tools: Tool[], strategy: SortStrategy): Tool[]`.
*   Strategies:
    *   `'cheapest'`: `a.price - b.price` (ASC).
    *   `'rating'`: `b.rating - a.rating` (DESC).
    *   `'balanced'`: `(b.rating / maxRating) - (a.price / maxPrice)` (Simple weighted score).

**Tests**
`/tests/sprint4-2/ranking.spec.ts`:
*   Create a shuffled list of tools.
*   Assert order is correct for each strategy.

**Accept When**
Tools are returned in the correct order for the requested strategy.

**LLM Priming**
`Array.sort`, `Comparator Function`, `Strategy Pattern`, `Weighted Scoring`

---

## Ticket-4203 — Selection Service Facade

**What / Why**
Combine filtering and ranking into a single callable service. This service also prepares the result for the next step (deciding whether to auto-install or pause for manual approval).

**Where**
`/src/discovery/selection/index.ts`

**Implementation Sketch**
*   Export `selectBestTool(tools: Tool[], prefs: UserPreferences): SelectionResult`.
*   `SelectionResult`: `{ candidates: Tool[], autoSelected: Tool | null, mode: 'auto' | 'manual' }`.
*   Flow:
    1.  `filtered = filterTools(tools, prefs)`
    2.  `ranked = rankTools(filtered, prefs.strategy)`
    3.  If `prefs.mode === 'auto'` && `ranked.length > 0`, set `autoSelected = ranked[0]`.
    4.  Return structure.

**Tests**
`/tests/sprint4-2/selectionService.spec.ts`:
*   Mock dependencies.
*   Verify that `manual` mode returns candidates but `autoSelected: null`.
*   Verify that `auto` mode picks the top ranked tool.

**Accept When**
The service correctly orchestrates filtering and ranking based on preferences.

**LLM Priming**
`Facade Pattern`, `Business Logic Layer`

---

## Ticket-4204 — Logic Layer Integration Test

**What / Why**
Verify that real data objects flow correctly through the entire logic chain without type errors or unexpected mutations.

**Where**
`/tests/sprint4-2/logicIntegration.spec.ts`

**Implementation Sketch**
*   Construct a realistic `UserPreferences` object.
*   Construct a realistic list of `Tool` objects (from Supabase mock).
*   Call `selectBestTool`.
*   Assert the final decision matches expectation (e.g., "The expensive 5-star tool was filtered out, so the cheap 4-star tool was picked").

**Tests**
Run the integration spec.

**Accept When**
Complex scenarios (filtering + sorting) produce the correct winner.

**LLM Priming**
`Integration Testing`, `Scenario-based Testing`

