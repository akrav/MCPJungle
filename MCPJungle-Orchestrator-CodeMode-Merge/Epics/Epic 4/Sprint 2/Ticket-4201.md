# Ticket-4201 — Safety Filters Implementation

**What / Why**
Before we rank tools, we must remove any that violate the user's hard constraints. This prevents accidental overspending or usage of low-quality tools.

**Where**
`/src/discovery/selection/filters.ts`

**Implementation Sketch**
*   Create `/src/discovery/selection/filters.ts`.
*   Import `Tool` and `UserPreferences` types.
*   Export `filterTools(tools: Tool[], prefs: UserPreferences): Tool[]`.
*   Implementation:
    *   Filter out if `tool.price_per_call > prefs.maxPriceCap`.
    *   Filter out if `tool.rating < prefs.minRatingThreshold`.
    *   (Edge case) If a tool has no rating (undefined), treat as 0 or handle per policy (likely filter out if strict).

**Tests**
`/tests/sprint4-2/filters.spec.ts`:
*   **Fixture**: List containing [CheapGood, CheapBad, ExpensiveGood, ExpensiveBad].
*   **Test 1**: Set low price cap -> Assert expensive tools removed.
*   **Test 2**: Set high rating threshold -> Assert bad tools removed.
*   **Test 3**: Combined constraints -> Assert only CheapGood remains.

**Accept When**
Tools exceeding caps are reliably removed from the list.

**LLM Priming (keywords/APIs)**
`Array.filter`, `Predicate Function`, `Safety Constraints`, `Pure Function`

