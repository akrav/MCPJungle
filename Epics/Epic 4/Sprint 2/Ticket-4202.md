# Ticket-4202 — Ranking Strategies (Cost/Rating)

**What / Why**
Sort the remaining tools based on what the user values most. This ensures the "best" tool (according to the user's criteria) is at the top of the list for auto-selection.

**Where**
`/src/discovery/selection/ranking.ts`

**Implementation Sketch**
*   Create `/src/discovery/selection/ranking.ts`.
*   Import `SortStrategy` type.
*   Export `rankTools(tools: Tool[], strategy: SortStrategy): Tool[]`.
*   **Strategies**:
    *   `'cheapest'`: Sorts purely by cost. Lowest price first.
        *   Implementation: `tools.sort((a, b) => a.price_per_call - b.price_per_call)`
        *   *Note*: The subtraction `-` here is just how JavaScript's `sort()` function works technically to determine order. It's not a business formula.
    *   `'rating'`: Sorts purely by quality. Highest rating first.
        *   Implementation: `tools.sort((a, b) => b.rating - a.rating)`
        *   *Note*: The subtraction `-` here is just how JavaScript's `sort()` function works technically to determine order. It's not a business formula.
    *   `'balanced'`: A composite sort for when the user wants "The best value" (Good quality but not too expensive).
        *   Since we can't sort by two different units (dollars and stars) directly, we calculate a single "Score" for each tool to compare them.
        *   **The Formula**: `Score = (Rating) - (Normalized Price Impact)`
            *   We *subtract* price because high price is bad.
            *   We *add* rating because high rating is good.
        *   Example Implementation:
            ```typescript
            const getScore = (tool) => {
              // Convert price to a 'penalty' (e.g. $0.01 = 1 point penalty)
              const pricePenalty = tool.price_per_call * 1000;
              // Rating is the 'reward' (e.g. 5 stars = 50 points)
              const ratingReward = tool.rating * 10;
              return ratingReward - pricePenalty;
            }
            // Sort by Score Descending (Highest Score First)
            tools.sort((a, b) => getScore(b) - getScore(a));
            ```

**Tests**
`/tests/sprint4-2/ranking.spec.ts`:
*   **Fixture**: List of tools with varying price/rating.
*   **Test Cheapest**: Assert lowest price is index 0.
*   **Test Rating**: Assert highest rating is index 0.
*   **Test Balanced**: Assert that a 4.8-star tool costing $0.001 beats a 5.0-star tool costing $0.05 (Better value wins).

**Accept When**
Tools are returned in the correct order for the requested strategy.

**LLM Priming (keywords/APIs)**
`Array.sort`, `Comparator Function`, `Strategy Pattern`, `Weighted Scoring`
